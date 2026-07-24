# Génère le modèle 3D du poste depuis src/scene/layout.json et exporte
# public/models/poste.glb. À lancer via :
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_kitchen.py
#
# Convention de nommage : les objets "zone_*" sont interactifs côté R3F
# (zone_drawer_0..3, zone_pass, zone_board, zone_book), tout le reste est décor.
#
# Repères : le layout est exprimé en coordonnées three.js (x droite, y haut,
# z vers le spectateur). Blender est en Z-up : on convertit ici, et l'export
# glTF (+Y up) restitue exactement les coordonnées three.js d'origine.
import json
import math
import random
from pathlib import Path

import bpy
import bmesh

ROOT = Path(__file__).resolve().parent.parent
L = json.loads((ROOT / "src/scene/layout.json").read_text())

bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(7)  # build reproductible : même « désordre » de mise en place à chaque régénération


# ---------- conversions three.js <-> Blender ----------

def loc(x, y, z):
    return (x, -z, y)


def dim(w, h, d):
    return (w, d, h)


def srgb(hexcode):
    h = hexcode.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def shade_hex(hexcode, factor):
    """Éclaircit (factor>1) ou assombrit (factor<1) une couleur hex — sert à
    varier la teinte des petits morceaux d'une même mise en place (haché)."""
    h = hexcode.lstrip("#")
    c = [max(0, min(255, round(int(h[i : i + 2], 16) * factor))) for i in (0, 2, 4)]
    return "#%02x%02x%02x" % tuple(c)


# ---------- matériaux ----------

def make_mat(name, color, rough=0.5, metal=0.0, emissive=None, strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*srgb(color), alpha)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if alpha < 1.0:
        # Transparence exportée en alphaMode BLEND côté glTF (three.js : material
        # transparent) → on voit à travers (hublots des portes).
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
        m.use_backface_culling = False
    if emissive:
        key = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
        bsdf.inputs[key].default_value = (*srgb(emissive), 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    return m


MAT = {
    # Inox satiné/brossé : metalness modérée pour réagir à la lumière diffuse
    # (à metalness ~1, tout dépend de l'env map et les façades virent au noir)
    "inox_bright": make_mat("inox_bright", "#c9cdd2", 0.35, 0.65),
    "inox": make_mat("inox", "#aab0b6", 0.5, 0.55),
    "inox_dark": make_mat("inox_dark", "#7c8187", 0.55, 0.5),
    "copper": make_mat("copper", "#b87333", 0.25, 1.0),
    "lamp_shade": make_mat("lamp_shade", "#b87333", 0.3, 0.9, "#ff7a2a", 0.5),
    "wood": make_mat("wood", "#9a6b42", 0.75),
    "wood_dark": make_mat("wood_dark", "#7d5738", 0.8),
    "paper": make_mat("paper", "#f2ecdc", 0.9),
    "leather": make_mat("leather", "#7a3b28", 0.6),
    "dark_metal": make_mat("dark_metal", "#3f4349", 0.55, 0.6),
    "slate": make_mat("slate", "#4b4e54", 0.9),
    "jar": make_mat("jar", "#3a3d42", 0.3),
    "lamp_bulb": make_mat("lamp_bulb", "#ffd9a0", 0.4, 0.0, "#ff9a3c", 5.0),
    "strip_glow": make_mat("strip_glow", "#f5e9d0", 0.4, 0.0, "#ffd9a0", 2.5),
    "bac_rim": make_mat("bac_rim", "#8b9096", 0.35, 0.8),
    # Lettres : cuivre clair peu métallique + légère émission → lisibles dans
    # la pénombre (le cuivre metalness 1.0 vire au noir sans reflets à capter)
    "copper_text": make_mat("copper_text", "#d08a45", 0.35, 0.55, "#7a3f12", 0.5),
    "ink": make_mat("ink", "#26262b", 0.7),
    # Post-its du parcours (tableau de brigade)
    "postit_0": make_mat("postit_0", "#f29bb5", 0.85),
    "postit_1": make_mat("postit_1", "#f2d64b", 0.85),
    "postit_2": make_mat("postit_2", "#9fd47a", 0.85),
    "postit_3": make_mat("postit_3", "#f2a05a", 0.85),
    "postit_4": make_mat("postit_4", "#7ab8f2", 0.85),
    # Légumes du billot : un légume = une famille de stack
    "veg_tomato": make_mat("veg_tomato", "#c0392b", 0.5),
    "veg_courgette": make_mat("veg_courgette", "#4c7a2f", 0.6),
    "veg_courgette_in": make_mat("veg_courgette_in", "#b7d178", 0.7),
    "veg_lemon": make_mat("veg_lemon", "#e0c33a", 0.55),
    "veg_onion": make_mat("veg_onion", "#e8d9be", 0.65),
    "veg_carrot": make_mat("veg_carrot", "#d97b2a", 0.6),
    # Décor de vraie cuisine
    "porcelain": make_mat("porcelain", "#eef0f2", 0.35),
    "toque": make_mat("toque", "#f4f4f0", 0.85),
    "bottle_oil": make_mat("bottle_oil", "#3d6b2a", 0.2, 0.0),
    "bottle_vin": make_mat("bottle_vin", "#5a1f1f", 0.2, 0.0),
    "cork": make_mat("cork", "#b58a4a", 0.8),
    "brass": make_mat("brass", "#c9a349", 0.35, 0.85),
    "herb": make_mat("herb", "#4f8a3a", 0.7),
    "terracotta": make_mat("terracotta", "#b5623a", 0.75),
    # Piano pro : fonte mate du coupe-feu, creux noir de la niche, bain de friture
    "cast_iron": make_mat("cast_iron", "#2b2d31", 0.88, 0.35),
    "cavity": make_mat("cavity", "#17181c", 0.95),
    "fry_oil": make_mat("fry_oil", "#d9a53c", 0.25, 0.0, "#c07a1e", 0.7),
    "frite": make_mat("frite", "#e8c25c", 0.7),
    # Mini-jeu du steak : viande crue (recolorée par R3F pendant la cuisson),
    # liseré de gras, et l'intérieur mat de la poêle en fonte.
    "steak_meat": make_mat("steak_meat", "#b23a48", 0.6),
    "steak_fat": make_mat("steak_fat", "#e6d9c2", 0.55),
    "skillet_in": make_mat("skillet_in", "#20222a", 0.7, 0.2),
    "room_floor": make_mat("room_floor", "#1a1c22", 0.9),
    "room_wall": make_mat("room_wall", "#2c2f38", 0.9),
    "frost": make_mat("frost", "#dfeaf2", 0.5, 0.0, "#9fc4e0", 0.6),
    "tablecloth": make_mat("tablecloth", "#e8e2d4", 0.85),
    "wine": make_mat("wine", "#6a1526", 0.3),
}


def text3d(name, body, x, y, z, size, material, extrude=0.004):
    """Texte 3D extrudé, face au spectateur (+z three.js), converti en mesh."""
    bpy.ops.object.text_add(location=loc(x, y, z))
    o = bpy.context.active_object
    o.name = name
    o.data.body = body
    o.data.size = size
    o.data.extrude = extrude
    o.data.align_x = "CENTER"
    o.data.align_y = "CENTER"
    o.rotation_euler = (1.5708, 0, 0)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    o.data.materials.append(material)
    return o


# ---------- primitives ----------

def box(name, x, y, z, w, h, d, material, bevel=0.005, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc(x, y, z))
    o = bpy.context.active_object
    o.name = name
    o.scale = dim(w, h, d)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rot:
        o.rotation_euler = rot
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    o.data.materials.append(material)
    return o


def cyl(name, x, y, z, radius, height, material, axis="y", vertices=20, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=height, vertices=vertices, location=loc(x, y, z)
    )
    o = bpy.context.active_object
    o.name = name
    if axis == "x":  # barre horizontale le long de X
        o.rotation_euler = (0, 1.5708, 0)
    elif axis == "z":  # axe selon la profondeur three.js (face au spectateur)
        o.rotation_euler = (1.5708, 0, 0)
    if rot:
        o.rotation_euler = rot
    o.data.materials.append(material)
    return o


def sphere(name, x, y, z, radius, material, scale=None, wire=None, subdiv=2):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=radius, subdivisions=subdiv, location=loc(x, y, z))
    o = bpy.context.active_object
    o.name = name
    if scale:
        o.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if wire:  # cage filaire (fouet)
        mod = o.modifiers.new("wire", "WIREFRAME")
        mod.thickness = wire
    o.data.materials.append(material)
    return o


def cone(name, x, y, z, r_bottom, r_top, height, material, vertices=24):
    bpy.ops.mesh.primitive_cone_add(
        radius1=r_bottom, radius2=r_top, depth=height, vertices=vertices,
        location=loc(x, y, z),
    )
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    return o


def frustum(name, x, y_bottom, z, w1, d1, w2, d2, h, material):
    """Pyramide tronquée rectangulaire (la jupe de la hotte)."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    vb = [bm.verts.new((sx * w1 / 2, sy * d1 / 2, 0)) for sx, sy in corners]
    vt = [bm.verts.new((sx * w2 / 2, sy * d2 / 2, h)) for sx, sy in corners]
    bm.faces.new(vb)
    bm.faces.new(vt)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([vb[i], vb[j], vt[j], vt[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    o.location = loc(x, y_bottom, z)
    o.data.materials.append(material)
    return o


def flat_poly(name, pts, x, y, z, material, thickness, bevel=0.0012):
    """Silhouette 2D pleine, épaissie par SOLIDIFY — la façon la moins chère de
    faire une lame ou un manche : on décrit un contour, pas un maillage.
    Construite dans le plan horizontal (Blender XY), longueur vers +x three.js ;
    le profil monte vers -z three.js (dos de lame) et descend vers +z (fil)."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((px, py, 0.0)) for px, py in pts]
    bm.faces.new(verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    o.location = loc(x, y, z)
    solid = o.modifiers.new("solidify", "SOLIDIFY")
    solid.thickness = thickness
    solid.offset = 0
    bev = o.modifiers.new("bevel", "BEVEL")
    bev.width = bevel
    bev.segments = 1
    o.data.materials.append(material)
    return o


def apply_mods(o):
    """Applique la pile de modificateurs de `o`.

    Nécessaire avant tout join() : bpy.ops.object.join() ne conserve QUE la pile
    de l'objet actif et jette celle des autres. Un solidify oublié, et la lame
    part à l'export en plan d'épaisseur nulle."""
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def knife_blade(name, x, y, z, length, material, thickness=0.004):
    """Lame de couteau de chef : silhouette effilée à plat, pointe vers +x."""
    L = length
    pts = [
        (0.0, 0.019), (L * 0.5, 0.017), (L * 0.82, 0.011), (L, 0.001),
        (L * 0.8, -0.012), (L * 0.5, -0.018), (L * 0.2, -0.019), (0.0, -0.018),
    ]
    return flat_poly(name, pts, x, y, z, material, thickness)


def join(name, parts):
    """Fusionne des objets ; l'origine et le nom sont ceux du premier."""
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    parts[0].name = name
    return parts[0]


# ---------- couteaux ----------

def serrated_edge(x_tip, y, teeth, amp, x_heel=0.0):
    """Fil denté : festons réguliers de la pointe vers le talon. C'est la
    silhouette qui fait reconnaître un couteau à pain — pas sa longueur."""
    pts = []
    for k in range(teeth + 1):
        t = k / teeth
        pts.append((x_tip + (x_heel - x_tip) * t, y + (amp if k % 2 else 0.0)))
    return pts


# Chaque type a SA silhouette : dos (du talon vers la pointe) puis fil (de la
# pointe vers le talon), le contour se referme tout seul. Un couteau à pain
# n'est pas un couteau de chef rétréci, et un santoku se reconnaît à son bout
# tombant — sans ça les cinq lames ne sont qu'une même forme à cinq échelles.
KNIVES = {
    "office": dict(
        spine=[(0.0, 0.011), (0.075, 0.010), (0.113, 0.002)],
        serrated=(0.113, -0.010, 9, 0.0035), handle=0.082, hthick=0.021),
    "pain": dict(
        spine=[(0.0, 0.014), (0.185, 0.0135), (0.203, 0.008)],
        serrated=(0.203, -0.0135, 17, 0.004), handle=0.098, hthick=0.022),
    "chef": dict(
        spine=[(0.0, 0.030), (0.10, 0.028), (0.155, 0.021), (0.185, 0.010), (0.20, 0.0)],
        edge=[(0.16, -0.013), (0.11, -0.017), (0.05, -0.018), (0.0, -0.018)],
        handle=0.104, hthick=0.024),
    "santoku": dict(
        spine=[(0.0, 0.031), (0.09, 0.030), (0.125, 0.027), (0.150, 0.017), (0.163, 0.003)],
        edge=[(0.152, -0.008), (0.12, -0.014), (0.06, -0.016), (0.0, -0.016)],
        handle=0.10, hthick=0.023, kullen=6),
    "trancher": dict(
        spine=[(0.0, 0.013), (0.15, 0.012), (0.185, 0.006), (0.195, 0.0)],
        edge=[(0.10, -0.013), (0.0, -0.013)],
        handle=0.098, hthick=0.022),
}


def western_knife(name, kind):
    """Couteau occidental complet, monté à plat, TALON À L'ORIGINE et pointe
    vers +x : mitre pleine, manche galbé à 3 rivets. L'appelant n'a plus qu'à
    poser l'objet et l'orienter."""
    K = KNIVES[kind]
    spine = K["spine"]
    edge = K["edge"] if "edge" in K else serrated_edge(*K["serrated"])
    hl, ht = K["handle"], K["hthick"]
    s0, e0 = spine[0][1], edge[-1][1]  # hauteur de lame au talon
    parts = [flat_poly(f"{name}_blade", spine + edge, 0, 0, 0, MAT["knife_steel"], 0.0035)]
    # Mitre pleine : le bloc d'acier entre lame et manche, signature occidentale
    parts.append(box(f"{name}_bolster", -0.011, 0, -(s0 + e0) / 2,
                     0.022, ht + 0.002, (s0 - e0) + 0.004, MAT["knife_steel"], bevel=0.004))
    # Manche galbé : renflé sous les doigts, arrondi au pommeau
    parts.append(flat_poly(f"{name}_handle", [
        (-0.004, 0.0165), (-hl * 0.25, 0.0175), (-hl * 0.62, 0.0163), (-hl * 0.88, 0.0128), (-hl, 0.006),
        (-hl, -0.007), (-hl * 0.88, -0.0138), (-hl * 0.6, -0.0162), (-hl * 0.25, -0.0157), (-0.004, -0.014),
    ], 0, 0, 0, MAT["knife_handle"], ht, bevel=0.003))
    # Les 3 rivets : le détail qui dit « couteau de cuisine » au premier regard
    for k, f in enumerate((0.24, 0.53, 0.82)):
        parts.append(cyl(f"{name}_rivet_{k}", -hl * f, 0, -0.001, 0.0042, ht + 0.004,
                         MAT["knife_rivet"], axis="y", vertices=10))
    # Alvéoles du santoku : posées quasi à fleur de lame (0,7 mm) — assez pour
    # se voir et pour ne pas z-fighter, trop peu pour faire des bosses.
    for k in range(K.get("kullen", 0)):
        parts.append(cyl(f"{name}_kullen_{k}", 0.035 + k * 0.021, 0.0016, 0.006,
                         0.0062, 0.0018, MAT["knife_hollow"], axis="y", vertices=12))
    for p in parts:
        apply_mods(p)  # cf. apply_mods : join() jetterait les solidify des lames
    return join(name, parts)


# ---------- le poste ----------

C, W = L["counter"], L["worktop"]
TOP_Y = C["h"] + W["t"]  # dessus du plan de travail

box("counter_body", 0, C["h"] / 2, 0, C["w"], C["h"], C["d"], MAT["inox"])
box("worktop", 0, C["h"] + W["t"] / 2, 0, W["w"], W["t"], W["d"], MAT["inox_bright"])

B = L["billot"]
box("billot", B["x"], TOP_Y + B["t"] / 2, B["z"], B["w"], B["t"], B["d"], MAT["wood"], bevel=0.008)

# Tiroirs (zones Projets) : 2 rangées de 4, un tiroir par projet (le 8e est
# le « tiroir secret » du chef). Origine de l'objet = centre de la façade,
# pour que l'animation de coulissement côté R3F soit un simple position.z.
D = L["drawers"]
NC = len(D["cols"])
for i in range(NC * len(D["rows"])):
    x = D["cols"][i % NC]
    y = D["rows"][i // NC]
    front = box(f"front_{i}", x, y, D["z"], D["w"], D["h"], 0.04, MAT["inox_bright"])
    handle = cyl(f"handle_{i}", x, y + 0.08, D["z"] + 0.032, 0.012, 0.24, MAT["copper"], axis="x", vertices=12)
    caisson = box(f"caisson_{i}", x, y - 0.02, D["z"] - 0.16, D["w"] - 0.05, D["h"] - 0.07, 0.28, MAT["dark_metal"], bevel=0)
    # Bon de commande posé au fond du tiroir, visible à l'ouverture
    slip = box(f"drawslip_{i}", x, y + 0.078, D["z"] - 0.14, 0.4, 0.004, 0.18, MAT["paper"], bevel=0, rot=(0, 0.04 - 0.02 * (i % NC), 0))
    join(f"zone_drawer_{i}", [front, handle, caisson, slip])

# ---------- le passe (zone Contact) ----------

P = L["pass"]
frame = []
for sx in (-1, 1):
    px = P["x"] + sx * (P["w"] / 2 - 0.03)
    frame.append(cyl(f"post_{sx}", px, (TOP_Y + P["barY"]) / 2, P["z"], 0.018, P["barY"] - TOP_Y, MAT["inox_dark"]))
frame.append(cyl("bar", P["x"], P["barY"], P["z"], 0.014, P["w"], MAT["inox_dark"], axis="x"))
join("pass_frame", frame)

cyl("lamp_cord", P["x"], (P["barY"] + P["lampY"] + 0.08) / 2, P["z"], 0.005, P["barY"] - P["lampY"] - 0.08, MAT["dark_metal"], vertices=8)
cone("lamp_shade", P["x"], P["lampY"], P["z"], 0.13, 0.035, 0.16, MAT["lamp_shade"])
cyl("lamp_bulb", P["x"], P["lampY"] - 0.06, P["z"], 0.045, 0.02, MAT["lamp_bulb"], vertices=16)

box("zone_pass", P["x"], P["shelfY"], P["z"], P["w"], 0.035, P["d"], MAT["inox_bright"])

# Le passe = le CONTACT : on le signale franchement — enseigne cuivrée
# « SERVICE ! » (le cri du passe — les réservations, elles, vivent en salle)
# + bons de commande pincés sur la barre (l'appel au clic)
psign = text3d("pass_sign", "SERVICE !", 0, 0, 0, 0.07, MAT["copper_text"], extrude=0.003)
psign.location = loc(P["x"], 1.75, P["z"])
for sx in (-1, 1):
    cyl(f"pass_sign_rod_{sx}", P["x"] + sx * 0.18, 1.67, P["z"], 0.004, 0.08, MAT["dark_metal"], vertices=8)
for k, (bx_, rz) in enumerate(((0.56, 0.06), (0.68, -0.04), (1.02, 0.05), (1.14, -0.07))):
    # rot Blender Y = léger « roulis » de part et d'autre de la pince
    box(f"pass_bon_{k}", bx_, 1.565, P["z"], 0.075, 0.1, 0.003, MAT["paper"], bevel=0, rot=(0, rz, 0))
    box(f"pass_clip_{k}", bx_, 1.617, P["z"], 0.022, 0.018, 0.012, MAT["inox_bright"], bevel=0.002)

# ---------- tableau de brigade (zone Skills) ----------

BO = L["board"]
box("board_frame", BO["x"], BO["y"], BO["z"] - 0.005, BO["w"] + 0.05, BO["h"] + 0.05, 0.02, MAT["wood_dark"])
box("zone_board", BO["x"], BO["y"], BO["z"] + 0.006, BO["w"], BO["h"], 0.012, MAT["slate"], bevel=0)
# Le parcours en post-its qui se suivent, chronologiques et ascendants —
# chaque étape porte une ligne d'explication (retours UX : « TISSEC ?
# Théodore ? on ne sait pas ce que c'est », « Bac Pro ou BTS ? »).
#
# POSTIT_W est calé au maximum que laisse la largeur du tableau : 5 papiers +
# leur roulis tiennent tout juste dans BO["w"]. À cette taille ils se touchent
# presque, donc les chevrons « > » d'avant (écrasés entre deux papiers, plus
# lisibles du tout) cèdent la place à une punaise cuivre par post-it.
PARCOURS = [
    ("2019", "BAC ES", "bac général\nLycée Colbert"),
    ("2020", "BAC PRO\nTISSEC", "chauffage &\nclimatisation"),
    ("2023", "THÉODORE", "resto gastro\ndemi-chef"),
    ("2024", "5 MAINS", "resto gastro\nchef de partie"),
    ("2025", "EPITECH", "dev web\nen alternance"),
]
POSTIT_W = 0.165
POSTIT_XS = [-0.336, -0.168, 0.0, 0.168, 0.336]
POSTIT_YS = [-0.245, -0.135, -0.025, 0.085, 0.195]
postits = [text3d("board_title", "LE PARCOURS", BO["x"], BO["y"] + 0.325, BO["z"] + 0.016, 0.046, MAT["copper_text"], extrude=0.002)]
for i, (year, label, detail) in enumerate(PARCOURS):
    px_, py_ = BO["x"] + POSTIT_XS[i], BO["y"] + POSTIT_YS[i]
    postits.append(box(f"postit_{i}", px_, py_, BO["z"] + 0.014, POSTIT_W, POSTIT_W, 0.004,
                       MAT[f"postit_{i}"], bevel=0, rot=(0, 0.05 - 0.03 * i, 0)))
    # « BAC PRO / TISSEC » tient sur 3 lignes là où les autres en font 2 : le
    # bloc reste centré haut, la punaise est reléguée dans le coin pour ne
    # jamais mordre dessus.
    postits.append(text3d(f"postit_txt_{i}", f"{year}\n{label}", px_, py_ + 0.031, BO["z"] + 0.019, 0.0225, MAT["ink"], extrude=0.001))
    postits.append(text3d(f"postit_sub_{i}", detail, px_, py_ - 0.049, BO["z"] + 0.019, 0.0182, MAT["ink"], extrude=0.001))
    postits.append(cyl(f"postit_pin_{i}", px_ - POSTIT_W / 2 + 0.018, py_ + POSTIT_W / 2 - 0.018, BO["z"] + 0.021,
                       0.007, 0.008, MAT["copper"], axis="z", vertices=12))
join("board_parcours", postits)

# ---------- étagère + livre (zone About) ----------

S, BK = L["shelf"], L["book"]
plank_top = S["y"] + 0.0175
box("shelf_plank", S["x"], S["y"], S["z"], S["w"], 0.035, S["d"], MAT["wood"], bevel=0.006)
# Bocaux à épices = 2e instrument du xylophone (timbre « verre », cf. R3F)
for k, dx in enumerate((-0.3, -0.17)):
    jar = [cyl(f"jar_body_{k}", S["x"] + dx, plank_top + 0.065, S["z"], 0.045, 0.13, MAT["jar"], vertices=16)]
    jar.append(cyl(f"jar_lid_{k}", S["x"] + dx, plank_top + 0.137, S["z"], 0.046, 0.014, MAT["copper"], vertices=16))
    join(f"zone_glass_{k}", jar)

cover = box("book_cover", BK["x"], plank_top + 0.015, S["z"] + 0.01, BK["w"], 0.03, BK["d"], MAT["leather"], bevel=0.004)
pages = [
    box(f"page_{s}", BK["x"] + s * 0.088, plank_top + 0.048, S["z"] + 0.01, 0.19, 0.012, BK["d"] - 0.03,
        MAT["paper"], bevel=0, rot=(0, -s * 0.15, 0))
    for s in (-1, 1)
]
join("zone_book", [cover, *pages])

# ---------- machine à bons + ticket CV ----------

T = L["ticket"]
box("ticket_machine", T["x"], TOP_Y + 0.07, T["z"], 0.16, 0.14, 0.15, MAT["dark_metal"], bevel=0.008)
box("ticket_paper", T["x"], TOP_Y + 0.16, T["z"] + 0.02, 0.07, 0.09, 0.003, MAT["paper"], bevel=0, rot=(-0.25, 0, 0))

# ---------- saladette (mise en place) ----------

SA = L["saladette"]
sal_top = TOP_Y + SA["h"]
box("saladette_body", SA["x"], TOP_Y + SA["h"] / 2, SA["z"], SA["w"], SA["h"], SA["d"], MAT["inox_bright"], bevel=0.006)

# Chaque bac = une zone interactive (famille de skills). Couleurs alignées sur
# les légumes du billot : tomate=FRONT rouge, courgette=BACK vert, citron=
# DEVOPS jaune, oignon=MERN crème, carotte=SOFT orange. Le contenu est une
# mise en place HACHÉE (petits dés jumbled, 3 nuances par bac) plutôt qu'un
# bloc plat uni — plus proche d'une vraie saladette de brigade.
MISE_HEX = ["#a83c2e", "#5a8a3c", "#d8b84a", "#e6dcc4", "#c9762e"]
mise_variants = [
    [
        make_mat(f"mise_{i}_a", hx, 0.55),
        make_mat(f"mise_{i}_b", shade_hex(hx, 1.18), 0.6),
        make_mat(f"mise_{i}_c", shade_hex(hx, 0.78), 0.65),
    ]
    for i, hx in enumerate(MISE_HEX)
]


def dice_pile(prefix, cx, cz, y0, w, d, mats, count=18, size=0.024):
    """Mise en place hachée : mélange de petits dés (cubes biseautés) et de
    morceaux arrondis (~1 pièce sur 4, icosphères légèrement aplaties — grain,
    pois, rondelle) pour plus de détail/variété que de simples dés uniformes.
    Position/taille/rotation aléatoires (seed fixe → build reproductible),
    teinte piochée parmi les 3 nuances du bac."""
    pieces = []
    for k in range(count):
        px = cx + random.uniform(-w / 2 + size * 0.5, w / 2 - size * 0.5)
        pz = cz + random.uniform(-d / 2 + size * 0.5, d / 2 - size * 0.5)
        mat = random.choice(mats)
        if random.random() < 0.25:
            r = size * random.uniform(0.26, 0.38)
            sy = random.uniform(0.7, 0.9)
            pieces.append(sphere(f"{prefix}_{k}", px, y0 + r * sy * 0.85, pz, r, mat, scale=(1, sy, 1)))
        else:
            sx = size * random.uniform(0.55, 1.0)
            sy = size * random.uniform(0.32, 0.5)
            sz = size * random.uniform(0.55, 1.0)
            pieces.append(box(
                f"{prefix}_{k}", px, y0 + sy / 2, pz, sx, sy, sz, mat,
                bevel=0.0022,
                rot=(random.uniform(-0.22, 0.22), random.uniform(0, math.pi), random.uniform(-0.22, 0.22)),
            ))
    return pieces


bac_names = ["FRONT", "BACK", "DEVOPS", "MERN", "SOFT"]
n = SA["bacs"]
usable = SA["w"] - 0.06
step = usable / n
bac_labels = []
for i in range(n):
    bx = SA["x"] - usable / 2 + step * (i + 0.5)
    rim = box(f"bacrim_{i}", bx, sal_top + 0.008, SA["z"], step - 0.02, 0.016, SA["d"] - 0.06, MAT["bac_rim"], bevel=0)
    pile = dice_pile(f"mise_{i}", bx, SA["z"], sal_top + 0.014, step - 0.05, SA["d"] - 0.095, mise_variants[i % len(mise_variants)])
    join(f"zone_bac_{i}", [rim, *pile])
    bac_labels.append(text3d(f"baclabel_{i}", bac_names[i], bx, TOP_Y + SA["h"] - 0.05, SA["z"] + SA["d"] / 2 + 0.004, 0.032, MAT["copper_text"], extrude=0.002))
join("bac_labels", bac_labels)

# ---------- hotte ----------

H = L["hood"]
box("hood_rim", H["x"], H["rimY"] + H["rimH"] / 2, H["z"], H["w"], H["rimH"], H["d"], MAT["inox_bright"], bevel=0.008)
box("hood_filter", H["x"], H["rimY"] + 0.01, H["z"], H["w"] - 0.2, 0.05, H["d"] - 0.16, MAT["dark_metal"], bevel=0)
frustum("hood_taper", H["x"], H["rimY"] + H["rimH"], H["z"], H["w"], H["d"], H["topW"], H["topD"], H["taperH"], MAT["inox"])
box("hood_duct", H["x"], H["rimY"] + H["rimH"] + H["taperH"] + H["ductH"] / 2, H["z"], H["topW"] - 0.25, H["ductH"], H["topD"] - 0.1, MAT["inox_dark"])
# Rampe lumineuse sous le bord avant de la hotte
box("hood_light", H["x"], H["rimY"] - 0.02, H["z"] + H["d"] / 2 - 0.06, H["w"] - 0.3, 0.04, 0.05, MAT["strip_glow"], bevel=0)

# ---------- batterie de cuivre, ustensiles, accessoires (décor) ----------

MAT["copper_pot"] = make_mat("copper_pot", "#c5803f", 0.27, 0.8)
MAT["iron"] = make_mat("iron", "#2e2f33", 0.5, 0.6)
MAT["linen"] = make_mat("linen", "#e9e4d8", 0.9)
MAT["laptop_screen"] = make_mat("laptop_screen", "#0c100d", 0.2, 0.0, "#20301f", 1.0)
MAT["duck"] = make_mat("duck", "#2f7fd6", 0.45)  # bleu Epitech, évidemment
MAT["beak"] = make_mat("beak", "#d97b2a", 0.5)
MAT["epitech_blue"] = make_mat("epitech_blue", "#1a72d8", 0.55)
MAT["white_text"] = make_mat("white_text", "#f2f4f8", 0.4, 0.0, "#c8d4e6", 0.4)
MAT["flame"] = make_mat("flame", "#ff9540", 0.6, 0.0, "#ff7a20", 2.0)
MAT["door_paint"] = make_mat("door_paint", "#454b52", 0.6, 0.15)
MAT["wall_paint"] = make_mat("wall_paint", "#2b3036", 0.85)
MAT["glass"] = make_mat("glass", "#12161a", 0.08, 0.4)
# Verre de hublot RÉELLEMENT transparent : on voit la cuisine à travers les
# portes battantes. Alpha très bas + rugosité minimale (verre quasi clair, le
# reflet se réduit à un petit éclat net au lieu d'un voile laiteux opaque).
MAT["door_window"] = make_mat("door_window", "#e4eef4", 0.04, 0.0, alpha=0.12)
MAT["rubber"] = make_mat("rubber", "#17181b", 0.85)
# Acier des lames : metalness volontairement modérée. À 0,9 une lame plaquée au
# mur, loin de la rampe de hotte, n'a rien à réfléchir et vire au gris sale —
# même piège que copper_text. À 0,45 elle capte la lumière diffuse et redevient
# de l'acier clair.
MAT["knife_steel"] = make_mat("knife_steel", "#dde1e6", 0.26, 0.45)
MAT["knife_handle"] = make_mat("knife_handle", "#2a2c30", 0.55, 0.1)
MAT["knife_rivet"] = make_mat("knife_rivet", "#e9ecef", 0.3, 0.7)
MAT["knife_hollow"] = make_mat("knife_hollow", "#b4bac1", 0.3, 0.85)

RAIL_Z = -0.41  # barres murales, 4 cm devant le mur


def rail(name, x0, x1, y):
    parts = [cyl(f"{name}_bar", (x0 + x1) / 2, y, RAIL_Z, 0.011, x1 - x0, MAT["inox_dark"], axis="x", vertices=12)]
    for k, xe in enumerate((x0 + 0.03, x1 - 0.03)):
        parts.append(cyl(f"{name}_mount_{k}", xe, y, -0.432, 0.008, 0.045, MAT["inox_dark"], axis="z", vertices=10))
    return parts


def hook(name, x, y_rail):
    return cyl(name, x, y_rail - 0.027, RAIL_Z, 0.0045, 0.055, MAT["iron"], vertices=8)


# Casseroles en cuivre suspendues par ordre décroissant — ET jouables :
# chaque casserole est une zone « note » (xylophone). Le 1er objet du join
# est le crochet → l'origine sert de pivot pour le balancement côté R3F.
POT_RAIL_Y = 1.62
join("potrail", rail("potrail", 1.3, 2.12, POT_RAIL_Y))
px = 1.42
sizes = [0.105, 0.09, 0.078, 0.066]
for i, r in enumerate(sizes):
    cy = POT_RAIL_Y - 0.05 - r
    note = [hook(f"note_hook_{i}", px, POT_RAIL_Y)]
    note.append(cyl(f"note_body_{i}", px, cy, -0.365, r, 0.085, MAT["copper_pot"], axis="z", vertices=28))
    note.append(cyl(f"note_rim_{i}", px, cy, -0.322, r + 0.006, 0.014, MAT["copper_pot"], axis="z", vertices=28))
    th = 0.35 + 0.06 * i  # inclinaison légèrement différente par casserole
    note.append(cyl(
        f"note_handle_{i}",
        px + (r + 0.08) * math.sin(th), cy - (r + 0.08) * math.cos(th), -0.365,
        0.009, 0.17, MAT["iron"], rot=(0, -th, 0), vertices=10,
    ))
    join(f"zone_note_{i}", note)
    if i + 1 < len(sizes):
        px += r + sizes[i + 1] + 0.04

# Barre d'ustensiles : louche, écumoire, spatule bois, fouet — et deuxième
# famille d'instruments du poste après les casseroles. Chacun est sa propre
# zone (zone_ust_*) : au clic il sonne dans son timbre (cf. audio/sfx.js,
# utensilHit) et se balance sur son crochet. Comme pour les casseroles, le
# 1er objet du join est le crochet → son origine sert de pivot au pendule.
UT_RAIL_Y = 1.58
UZ = -0.4
join("utrail", rail("utrail", -1.98, -1.28, UT_RAIL_Y))

louche = [hook("louche_hook", -1.86, UT_RAIL_Y)]
louche.append(cyl("louche_handle", -1.86, 1.425, UZ, 0.006, 0.24, MAT["inox_bright"], rot=(0, -0.05, 0), vertices=10))
louche.append(sphere("louche_bowl", -1.87, 1.29, UZ, 0.042, MAT["inox_bright"], scale=(1, 1, 0.62)))
join("zone_ust_0", louche)

ecumoire = [hook("ecumoire_hook", -1.66, UT_RAIL_Y)]
ecumoire.append(cyl("ecumoire_handle", -1.66, 1.425, UZ, 0.006, 0.24, MAT["inox_bright"], rot=(0, 0.04, 0), vertices=10))
ecumoire.append(cyl("ecumoire_disc", -1.655, 1.29, UZ, 0.046, 0.008, MAT["inox_bright"], axis="z", vertices=24))
join("zone_ust_1", ecumoire)

spatule = [hook("spatule_hook", -1.47, UT_RAIL_Y)]
spatule.append(cyl("spatule_handle", -1.47, 1.44, UZ, 0.007, 0.2, MAT["wood"], rot=(0, -0.03, 0), vertices=10))
spatule.append(box("spatule_blade", -1.472, 1.3, UZ, 0.055, 0.1, 0.012, MAT["wood"], bevel=0.004))
join("zone_ust_2", spatule)

fouet = [hook("fouet_hook", -1.31, UT_RAIL_Y)]
fouet.append(cyl("fouet_handle", -1.31, 1.485, UZ, 0.0075, 0.12, MAT["inox_bright"], vertices=10))
# Cage du fouet : 3 boucles de tore elliptiques croisées à 60°
for k in range(3):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.028, minor_radius=0.0028,
        major_segments=20, minor_segments=6,
        location=loc(-1.31, 1.375, UZ),
    )
    o = bpy.context.active_object
    o.name = f"fouet_loop_{k}"
    o.scale = (1, 1.7, 1)                       # ellipse allongée (local Y)
    o.rotation_euler = (1.5708, 0, k * 1.047)   # dressée puis tournée de 60°
    o.data.materials.append(MAT["inox_bright"])
    fouet.append(o)
join("zone_ust_3", fouet)

# Barre aimantée : les couteaux du chef à nu contre le mur, au-dessus du piano.
# Ni vitrine ni verre — à cet angle rasant un panneau transparent, même très peu
# opaque, réfléchissait plus qu'il ne montrait (Fresnel) et cachait les lames.
# L'acier nu sur le carrelage clair se lit bien mieux, et c'est de toute façon
# ce qu'on trouve dans une vraie cuisine pro. Calée à la hauteur de la barre à
# ustensiles : les deux ne font plus qu'une seule ligne d'outils au mur.
#
# Montage : western_knife construit à plat, pointe vers +x. Rx(90°) dresse la
# lame face au spectateur, Ry(-90°) la fait pivoter DANS le plan du mur, pointe
# en l'air (rotation Blender Y = rotation three.js Z, au signe près) — d'où le
# couple d'angles. Le `lean` incline chaque couteau de quelques degrés : cinq
# lames parfaitement parallèles font décalcomanie.
BAR_X0, BAR_X1 = -2.90, -2.10
BAR_Y, BAR_Z = UT_RAIL_Y, -0.425
KNIFE_Z = -0.404  # plaqués sur la face avant de la barre
bar = [box("knifebar_body", (BAR_X0 + BAR_X1) / 2, BAR_Y, BAR_Z,
           BAR_X1 - BAR_X0, 0.05, 0.035, MAT["inox_bright"], bevel=0.004)]
for k, bx in enumerate((BAR_X0 + 0.06, BAR_X1 - 0.06)):
    bar.append(cyl(f"knifebar_mount_{k}", bx, BAR_Y, BAR_Z - 0.028, 0.007, 0.03,
                   MAT["inox_dark"], axis="z", vertices=10))
join("knifebar", bar)

# (type, x, décalage du talon, inclinaison) — le talon plus ou moins haut fait
# les pointes en escalier de la photo de référence.
KNIFE_SET = [
    ("office", -2.82, -0.030, 0.030),
    ("pain", -2.66, 0.004, -0.020),
    ("chef", -2.50, 0.012, 0.015),
    ("santoku", -2.34, -0.004, -0.030),
    ("trancher", -2.18, -0.020, 0.020),
]
for kind, kx, dy, lean in KNIFE_SET:
    # préfixe `wallknife_` distinct du couteau du billot (« knife ») : le filtre
    # d'ombres NO_WALL_SHADOW côté R3F teste des noms, pas des objets
    o = western_knife(f"wallknife_{kind}", kind)
    o.location = loc(kx, BAR_Y + dy - 0.025, KNIFE_Z)
    o.rotation_euler = (1.5708, -1.5708 + lean, 0)

# Torchon plié sur sa barre, flanc gauche du poste (suit la largeur de la table)
SIDE = -C["w"] / 2
tor = [cyl("torchon_rod", SIDE - 0.035, 0.76, 0.08, 0.008, 0.3, MAT["inox_dark"], axis="z", vertices=10)]
for k, ze in enumerate((0.0, 0.16)):
    tor.append(cyl(f"torchon_mount_{k}", SIDE - 0.015, 0.76, ze, 0.006, 0.035, MAT["inox_dark"], axis="x", vertices=8))
tor.append(cyl("torchon_fold", SIDE - 0.035, 0.76, 0.08, 0.018, 0.15, MAT["linen"], axis="z", vertices=12))
tor.append(box("torchon_front", SIDE - 0.048, 0.645, 0.08, 0.014, 0.24, 0.15, MAT["linen"], bevel=0.004))
tor.append(box("torchon_back", SIDE - 0.02, 0.665, 0.08, 0.013, 0.19, 0.15, MAT["linen"], bevel=0.004))
join("torchon", tor)

# Accessoires posés : moulin à poivre, saloir, sauteuse cuivre
BT = L["billot"]["t"]
props = [
    cyl("mill_body", -0.02, TOP_Y + 0.058, 0.22, 0.028, 0.115, MAT["wood_dark"], vertices=18),
    cyl("mill_top", -0.02, TOP_Y + 0.125, 0.22, 0.012, 0.02, MAT["iron"], vertices=12),
    cyl("salt_box", 0.1, TOP_Y + 0.026, 0.27, 0.034, 0.052, MAT["wood"], vertices=18),
    cyl("saut_body", 0.34, TOP_Y + 0.034, 0.16, 0.085, 0.068, MAT["copper_pot"], vertices=28),
    cyl("saut_rim", 0.34, TOP_Y + 0.068, 0.16, 0.09, 0.012, MAT["copper_pot"], vertices=28),
    cyl("saut_handle", 0.505, TOP_Y + 0.05, 0.16, 0.009, 0.16, MAT["iron"], axis="x", vertices=10),
]
join("props_deco", props)

# La mise en place du jour, posée sur le billot (bien DEVANT la saladette,
# z >= 0.10, pour ne jamais clipper dans son bac). Un légume = une famille de
# stack (même couleur que le bac correspondant). Cliquer = ouvrir la famille.
BILLOT_TOP = TOP_Y + BT

# Le couteau du chef — objet séparé, animé côté R3F (il hache en boucle).
# Lame effilée (bmesh) posée à plat au fond du billot, manche galbé côté gauche.
KN_HEEL, KN_Z, KN_Y = -0.60, 0.12, BILLOT_TOP + 0.004
knife = [
    knife_blade("knife_blade", KN_HEEL, KN_Y, KN_Z, 0.18, MAT["knife_steel"]),
    cyl("knife_bolster", KN_HEEL - 0.006, KN_Y + 0.012, KN_Z, 0.017, 0.022, MAT["knife_steel"], axis="x", vertices=14),
    cyl("knife_handle", KN_HEEL - 0.075, KN_Y + 0.012, KN_Z, 0.016, 0.11, MAT["knife_handle"], axis="x", vertices=16),
    sphere("knife_pommel", KN_HEEL - 0.135, KN_Y + 0.012, KN_Z, 0.017, MAT["knife_handle"], scale=(0.7, 1, 1)),
]
join("knife", knife)

# La mise en place, bien étalée sur le billot : 5 légumes nettement séparés,
# tous visibles et cliquables depuis la vue d'ensemble (front z≈0.25, plus gros).
veg_tomato = [sphere("tomato_body", -0.68, BILLOT_TOP + 0.05, 0.25, 0.05, MAT["veg_tomato"], scale=(1, 1, 0.92))]
veg_tomato.append(cyl("tomato_stem", -0.68, BILLOT_TOP + 0.098, 0.25, 0.006, 0.02, MAT["veg_courgette"], vertices=8))
join("zone_veg_0", veg_tomato)

join("zone_veg_3", [sphere("onion_body", -0.55, BILLOT_TOP + 0.047, 0.26, 0.047, MAT["veg_onion"], scale=(1, 1, 0.9))])

veg_courgette = [cyl("courgette_body", -0.42, BILLOT_TOP + 0.03, 0.25, 0.03, 0.10, MAT["veg_courgette"], axis="x", vertices=18)]
for k, dx in enumerate((0.072, 0.098)):
    veg_courgette.append(cyl(f"courgette_slice_{k}", -0.42 + dx, BILLOT_TOP + 0.03, 0.25, 0.03, 0.008,
                             MAT["veg_courgette_in"], axis="x", vertices=18))
join("zone_veg_1", veg_courgette)

join("zone_veg_2", [sphere("lemon_body", -0.28, BILLOT_TOP + 0.037, 0.26, 0.037, MAT["veg_lemon"], scale=(1.3, 1, 1))])

# Carotte couchée, au fond du billot (bien dégagée du couteau)
bpy.ops.mesh.primitive_cone_add(radius1=0.026, radius2=0.004, depth=0.17, vertices=14,
                                location=loc(-0.34, BILLOT_TOP + 0.028, 0.13))
carrot = bpy.context.active_object
carrot.name = "carrot_body"
carrot.rotation_euler = (0, 1.5708, 0)
carrot.data.materials.append(MAT["veg_carrot"])
join("zone_veg_4", [carrot])

# Plinthe au pied du mur (cache la jonction sol/carrelage)
box("plinth", 0, 0.05, -0.436, L["wall"]["w"], 0.1, 0.028, MAT["iron"], bevel=0)

# ---------- easter eggs ----------

# Laptop du dev, coin gauche de la table (zone → mode classique).
# L'écran est un PLANE (UV 0→1 complètes) : R3F y projette une texture
# canvas « terminal » au chargement, via le matériau nommé laptop_screen.
LP = L["laptop"]
LX, LZ = LP["x"], LP["z"]
lp_base = box("lp_base", LX, TOP_Y + 0.012, LZ, 0.32, 0.024, 0.22, MAT["dark_metal"], bevel=0.004)
lp_kb = box("lp_kb", LX, TOP_Y + 0.026, LZ + 0.02, 0.28, 0.004, 0.12, MAT["iron"], bevel=0)
lp_slab = box("lp_screen_body", LX, TOP_Y + 0.11, LZ - 0.125, 0.32, 0.21, 0.014, MAT["dark_metal"], bevel=0.004, rot=(-0.28, 0, 0))
bpy.ops.mesh.primitive_plane_add(size=1, location=loc(LX, TOP_Y + 0.1125, LZ - 0.1164))
lp_screen = bpy.context.active_object
lp_screen.name = "lp_screen"
lp_screen.scale = (0.29, 0.18, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
lp_screen.rotation_euler = (1.5708 - 0.28, 0, 0)
lp_screen.data.materials.append(MAT["laptop_screen"])
laptop = join("zone_laptop", [lp_base, lp_kb, lp_slab, lp_screen])
laptop.rotation_euler = (0, 0, LP["yaw"])  # tourné vers le centre du poste

# Le canard de debug, posé sous la lampe chauffante du passe
duck_y = P["shelfY"] + 0.0175
duck = [
    sphere("duck_body", 0.55, duck_y + 0.042, -0.02, 0.045, MAT["duck"], scale=(1, 1.15, 0.85)),
    sphere("duck_head", 0.55, duck_y + 0.095, 0.005, 0.027, MAT["duck"]),
]
bpy.ops.mesh.primitive_cone_add(radius1=0.013, radius2=0.002, depth=0.032, vertices=10,
                                location=loc(0.55, duck_y + 0.09, 0.035))
beak = bpy.context.active_object
beak.name = "duck_beak"
beak.rotation_euler = (1.5708, 0, 0)
beak.data.materials.append(MAT["beak"])
duck.append(beak)
join("zone_duck", duck)

# La marque de l'imprimante à bons… EPITECH (bien visible désormais)
text3d("epitech_mark", "EPITECH", T["x"], TOP_Y + 0.045, T["z"] + 0.077, 0.032, MAT["copper_text"], extrude=0.002)

# ---------- le piano de cuisson (avec four) ----------

PI = L["piano"]
# Porte de four : UN SEUL panneau opaque, albédo sombre + émission ambre —
# pas de vitre transparente séparée. La version « verre translucide devant une
# lueur vive » cumulait trois pièges : faces coplanaires (z-fighting en
# mouvement), tri des transparents, et bloom sur un émissif saturé qui virait au
# rectangle orange fluo. Un panneau sombre légèrement émissif lit comme un four
# tiède derrière sa vitre, sans aucun de ces artefacts. L'intensité réelle est
# pilotée par useFrame (manette 4 = four) autour d'une valeur basse.
MAT["oven_glow"] = make_mat("oven_glow", "#1c120c", 0.35, 0.2, "#e0721e", 0.5)
sx, sz = PI["x"], PI["z"]
PTOP = PI["h"] + 0.06  # dessus du piano

# Caisson. La niche de droite est un VRAI trou — montant, linteau, socle — et
# pas un rectangle noir peint sur la façade : sans booléen, un simple panneau
# sombre posé au fond disparaît DANS le volume plein du meuble. C'est ce creux
# qui donne l'échelle d'un piano pro ; 1,34 m de façade uniformément fermée ne
# lirait plus que comme un très gros meuble.
BAY = PI["bay"]
HW = PI["w"] / 2


def piano_block(name, dx0, dx1, y0, y1, material=None, depth=None):
    return box(name, sx + (dx0 + dx1) / 2, (y0 + y1) / 2, sz, dx1 - dx0, y1 - y0,
               depth or PI["d"], material or MAT["dark_metal"], bevel=0.008)


piano_block("piano_body", -HW, BAY["dx0"], 0, PI["h"])                  # bloc de gauche (four)
piano_block("piano_upright", BAY["dx1"], HW, 0, PI["h"])                # montant d'extrémité
piano_block("piano_lintel", BAY["dx0"], BAY["dx1"], BAY["y1"], PI["h"])  # linteau (porte les manettes)
piano_block("piano_plinth", BAY["dx0"], BAY["dx1"], 0, BAY["y0"])       # socle
box("piano_top", sx, PI["h"] + 0.02, sz, PI["w"] + 0.02, 0.04, PI["d"] + 0.02, MAT["iron"], bevel=0.005)
box("piano_splash", sx, PI["h"] + 0.13, sz - PI["d"] / 2 + 0.02, PI["w"], 0.18, 0.03, MAT["inox_dark"], bevel=0.004)

# 4 feux vifs, groupés à GAUCHE du plan de cuisson : sur un piano pro les
# brûleurs ne sont pas répartis sur toute la longueur, ils occupent un poste et
# laissent la place au coupe-feu et à la friteuse.
for k, (dx, dz) in enumerate(PI["burners"]):
    cyl(f"grate_{k}", sx + dx, PTOP + 0.01, sz + dz, 0.1, 0.018, MAT["iron"], vertices=20)
    cyl(f"flame_{k}", sx + dx, PTOP + 0.022, sz + dz, 0.06, 0.012, MAT["flame"], vertices=16)

# Le coupe-feu : la grande plaque de fonte pleine, signature du piano français.
# Ses couronnes concentriques s'enlèvent pour approcher la casserole du foyer —
# c'est le point le plus chaud du poste, d'où la lueur au centre.
CF = PI["coupefeu"]
cfx = sx + CF["dx"]
box("coupefeu_plate", cfx, PTOP + 0.012, sz, CF["w"], 0.024, CF["d"], MAT["cast_iron"], bevel=0.004)
for k, r in enumerate((0.075, 0.112)):
    cyl(f"coupefeu_ring_{k}", cfx, PTOP + 0.026, sz, r, 0.005, MAT["iron"], vertices=28)
cyl("coupefeu_glow", cfx, PTOP + 0.0275, sz, 0.052, 0.004, MAT["oven_glow"], vertices=24)

# La friteuse encastrée, à l'extrémité droite : cuve, bain d'huile (émissif,
# il frémit côté R3F) et panier à frites suspendu par son anse.
FR = PI["friteuse"]
frx = sx + FR["dx"]
box("friteuse_tank", frx, PTOP + 0.006, sz, FR["w"], 0.024, FR["d"], MAT["inox_dark"], bevel=0.003)
box("friteuse_glow", frx, PTOP + 0.019, sz, FR["w"] - 0.045, 0.006, FR["d"] - 0.045, MAT["fry_oil"], bevel=0)
basket = [
    box("friteuse_basket", frx, PTOP + 0.055, sz, FR["w"] - 0.10, 0.07, FR["d"] - 0.13, MAT["inox_bright"], bevel=0.004),
    # Anse en étrier : deux montants + une barre, pas de rotation à gérer
    cyl("friteuse_bail", frx, PTOP + 0.145, sz, 0.006, FR["w"] - 0.12, MAT["iron"], axis="x", vertices=8),
]
for s_ in (-1, 1):
    basket.append(cyl(f"friteuse_bail_arm_{s_}", frx + s_ * (FR["w"] - 0.12) / 2, PTOP + 0.115, sz, 0.005, 0.06, MAT["iron"], vertices=8))
for k in range(6):
    fx = frx + (k % 3 - 1) * 0.045 + random.uniform(-0.008, 0.008)
    fz = sz + (k // 3 - 0.5) * 0.06 + random.uniform(-0.01, 0.01)
    basket.append(box(f"frite_{k}", fx, PTOP + 0.088, fz, 0.012, 0.012, 0.05, MAT["frite"],
                      bevel=0, rot=(0, random.uniform(-0.6, 0.6), 0)))
join("friteuse_panier", basket)

# Le four : cadre inox, porte-hublot en un seul panneau, poignée cuivre.
# ATTENTION à l'empilement en z : `oven_frame` est un panneau PLEIN (pas un
# cadre évidé), sa face avant est à FRONT_Z+0.01. La porte-hublot doit donc
# passer DEVANT, avec une marge nette — surtout aucune face coplanaire, sinon
# ça clignote en mouvement. Un seul panneau opaque (albédo sombre + émission),
# insetté par rapport au cadre pour que l'inox fasse une bordure de hublot.
OV = PI["oven"]
ovx = sx + OV["dx"]
FRONT_Z = sz + PI["d"] / 2
box("oven_frame", ovx, 0.42, FRONT_Z - 0.005, OV["w"], 0.46, 0.03, MAT["inox_bright"], bevel=0.006)
box("oven_glow", ovx, 0.43, FRONT_Z + 0.02, OV["w"] - 0.14, 0.30, 0.01, MAT["oven_glow"], bevel=0.004)
cyl("oven_handle", ovx, 0.69, FRONT_Z + 0.045, 0.014, OV["w"] - 0.06, MAT["copper"], axis="x", vertices=12)

# La niche : fond sombre au fond du trou, tablette, et la réserve du service
bayx = sx + (BAY["dx0"] + BAY["dx1"]) / 2
bayw = BAY["dx1"] - BAY["dx0"]
niche = [
    box("bay_back", bayx, (BAY["y0"] + BAY["y1"]) / 2, sz - PI["d"] / 2 + 0.02,
        bayw, BAY["y1"] - BAY["y0"], 0.02, MAT["cavity"], bevel=0),
    box("bay_shelf", bayx, 0.40, sz, bayw - 0.01, 0.016, PI["d"] - 0.08, MAT["inox_dark"], bevel=0.003),
]
# Bacs gastro posés SUR la tablette (dessus à 0,408) et marmite de réserve
# rangée DESSOUS : la niche est la desserte du poste, pas une vitrine vide.
for k in range(2):
    niche.append(box(f"bay_bac_{k}", bayx - 0.11, 0.424 + k * 0.036, sz + 0.02,
                     0.2, 0.032, 0.15, MAT["inox_bright"], bevel=0.004))
niche.append(cyl("bay_stack", bayx + 0.15, 0.25, sz + 0.02, 0.055, 0.25, MAT["inox_dark"], vertices=18))
join("piano_niche", niche)

# Les manettes — et « le piano » de cuisson finit par mériter son nom : chaque
# manette est une touche (gamme pentatonique, cf. audio/sfx.js pianoKey), et
# pousse son foyer au passage. Sept manettes : 4 feux, le coupe-feu, la
# friteuse, le four. Elles vivent dans la bande libre entre la poignée du four
# (y≈0.70) et le dessus du piano (y≈0.88) ; le repère cuivre montre le quart
# de tour. L'ORDRE compte, il est repris tel quel dans Kitchen.jsx.
KNOB_Y = 0.785
KNOB_Z = FRONT_Z
box("piano_knob_rail", sx, KNOB_Y, KNOB_Z - 0.006, PI["w"] - 0.05, 0.105, 0.02, MAT["inox_dark"], bevel=0.004)
for k, dx in enumerate(PI["knobs"]):
    kx = sx + dx
    join(f"zone_knob_{k}", [
        # 1er objet = la collerette, centrée sur l'axe → origine = pivot du quart de tour
        cyl(f"knob_base_{k}", kx, KNOB_Y, KNOB_Z + 0.012, 0.032, 0.016, MAT["inox_bright"], axis="z", vertices=18),
        cyl(f"knob_body_{k}", kx, KNOB_Y, KNOB_Z + 0.028, 0.026, 0.022, MAT["dark_metal"], axis="z", vertices=18),
        box(f"knob_mark_{k}", kx, KNOB_Y + 0.013, KNOB_Z + 0.041, 0.006, 0.026, 0.006, MAT["copper"], bevel=0),
    ])

# La marmite du service sur le feu arrière-gauche (cliquable : bloup)
px_, pz_ = sx + PI["burners"][0][0], sz + PI["burners"][0][1]
pot = [
    cyl("pot_body", px_, PTOP + 0.15, pz_, 0.115, 0.24, MAT["inox_bright"], vertices=28),
    cyl("pot_rim", px_, PTOP + 0.272, pz_, 0.118, 0.012, MAT["inox_dark"], vertices=28),
    cyl("pot_lid", px_ + 0.02, PTOP + 0.288, pz_ - 0.01, 0.117, 0.012, MAT["inox_bright"], vertices=28, rot=(0.09, 0, 0.06)),
    cyl("pot_knob", px_ + 0.025, PTOP + 0.31, pz_ - 0.012, 0.018, 0.025, MAT["iron"], vertices=12),
]
for s_ in (-1, 1):
    pot.append(cyl(f"pot_handle_{s_}", px_ + s_ * 0.128, PTOP + 0.23, pz_, 0.009, 0.05, MAT["iron"], axis="x", vertices=8))
join("zone_pot", pot)

# Petite casserole inox (feu arrière-droit) et sauteuse cuivre (feu avant-GAUCHE :
# déplacée du feu avant-droit pour libérer la place du mini-jeu du steak).
cyl("piano_saucepan", sx + PI["burners"][1][0], PTOP + 0.065, sz + PI["burners"][1][1], 0.07, 0.09, MAT["inox_bright"], vertices=22)
cyl("piano_saucepan_handle", sx + PI["burners"][1][0] + 0.14, PTOP + 0.1, sz + PI["burners"][1][1], 0.007, 0.14, MAT["iron"], axis="x", vertices=8)
cyl("piano_pan", sx + PI["burners"][2][0], PTOP + 0.05, sz + PI["burners"][2][1], 0.085, 0.07, MAT["copper_pot"], vertices=24)
cyl("piano_pan_handle", sx + PI["burners"][2][0] - 0.17, PTOP + 0.07, sz + PI["burners"][2][1], 0.008, 0.16, MAT["iron"], axis="x", vertices=8)

# ---------- mini-jeu : cuire le steak (feu avant-droit) ----------
# La poêle en fonte + le steak, sur le feu le plus en vue du piano (avant-droit,
# près de la caméra). Le steak est une zone à part (zone_steak) : au clic il
# lance/retourne la cuisson, R3F recolore la viande selon le côté cuit et le
# fait sauter dans la poêle (cf. Kitchen.jsx, useSteakStore). Nommé pour être
# ciblé isolément — la poêle reste décor, seule la viande est « jouable ».
STK_X, STK_Z = sx + PI["burners"][3][0], sz + PI["burners"][3][1]
skillet = [
    cyl("skillet_body", STK_X, PTOP + 0.018, STK_Z, 0.105, 0.03, MAT["cast_iron"], vertices=28),
    cyl("skillet_floor", STK_X, PTOP + 0.03, STK_Z, 0.092, 0.008, MAT["skillet_in"], vertices=28),
    cyl("skillet_handle", STK_X + 0.2, PTOP + 0.03, STK_Z, 0.011, 0.17, MAT["cast_iron"], axis="x", vertices=10),
]
join("skillet", skillet)
# Le steak : pavé bombé, posé à plat dans la poêle. Origine au centre → pivot
# franc pour le saut/retournement. Un liseré de gras clair sur un bord.
steak = [
    box("steak_meat", STK_X, PTOP + 0.05, STK_Z, 0.115, 0.028, 0.09, MAT["steak_meat"], bevel=0.012),
    box("steak_fat", STK_X, PTOP + 0.05, STK_Z + 0.052, 0.115, 0.024, 0.012, MAT["steak_fat"], bevel=0.006),
]
join("zone_steak", steak)

# ---------- décor de vraie cuisine ----------

# Pile d'assiettes (creux gauche du plan)
plates = []
for k in range(6):
    plates.append(cyl(f"plate_{k}", -1.28, TOP_Y + 0.008 + k * 0.012, -0.1, 0.092, 0.01, MAT["porcelain"], vertices=24))
join("plates_stack", plates)

# Toque du chef, posée à côté des assiettes
toque = [
    cyl("toque_band", -1.28, TOP_Y + 0.05, 0.14, 0.062, 0.08, MAT["toque"], vertices=20),
    sphere("toque_puff", -1.28, TOP_Y + 0.13, 0.14, 0.085, MAT["toque"], scale=(1, 0.8, 1)),
]
join("toque", toque)

# Balance de cuisine (creux gauche, devant les assiettes)
scale_ = [
    box("scale_base", -1.02, TOP_Y + 0.02, 0.12, 0.16, 0.04, 0.14, MAT["dark_metal"], bevel=0.006),
    cyl("scale_dial", -1.02, TOP_Y + 0.11, 0.05, 0.055, 0.03, MAT["porcelain"], axis="z", vertices=20),
    cyl("scale_dial_ring", -1.02, TOP_Y + 0.11, 0.066, 0.058, 0.008, MAT["brass"], axis="z", vertices=20),
    cyl("scale_pan", -1.02, TOP_Y + 0.05, 0.14, 0.075, 0.008, MAT["brass"], vertices=20),
]
join("kitchen_scale", scale_)

# Bouteilles huile & vinaigre (à droite du billot)
for k, (bx, mat) in enumerate(((0.56, "bottle_oil"), (0.66, "bottle_vin"))):
    bottle = [
        cyl(f"bottle_body_{k}", bx, TOP_Y + 0.09, 0.12, 0.032, 0.18, MAT[mat], vertices=18),
        cyl(f"bottle_neck_{k}", bx, TOP_Y + 0.2, 0.12, 0.012, 0.05, MAT[mat], vertices=12),
        cyl(f"bottle_cork_{k}", bx, TOP_Y + 0.235, 0.12, 0.013, 0.02, MAT["cork"], vertices=10),
    ]
    join(f"bottle_{k}", bottle)

# Petit pot d'herbes (basilic) sur l'étagère
herb = [cyl("herb_pot", S["x"] + 0.42, plank_top + 0.05, S["z"], 0.038, 0.075, MAT["terracotta"], vertices=16)]
for hx, hz, hy in [(0, 0, 0.13), (0.03, 0.02, 0.11), (-0.03, -0.01, 0.1), (0.01, -0.03, 0.12)]:
    herb.append(sphere(f"herb_leaf_{hx}_{hz}", S["x"] + 0.42 + hx, plank_top + hy, S["z"] + hz, 0.03, MAT["herb"], scale=(1, 1.2, 1)))
join("herb_plant", herb)

# ---------- la porte de la salle + LA SALLE du restaurant derrière ----------

SW = L["sideWalls"]["x"]
MAT["candle"] = make_mat("candle", "#ffcf87", 0.5, 0.0, "#ff9a3c", 3.0)
MAT["pendant_glow"] = make_mat("pendant_glow", "#ffd9a0", 0.5, 0.0, "#ffb066", 2.0)


# ---------- LA SALLE (droite) : la grande salle du restaurant ----------
# Vraie salle profonde (~5,6 m) vue depuis l'entrée : tapis rouge, allée de
# lustres, tables rondes dressées côté fenêtres, banquette bordeaux côté
# droit, pilastres, buffet + grand miroir « LE POSTE » au fond. Le maître
# d'hôtel accueille au départ de l'allée, pupitre RÉSERVATIONS à ses côtés.
MAT["salle_wall"] = make_mat("salle_wall", "#ede1cb", 0.9)
MAT["salle_wall2"] = make_mat("salle_wall2", "#ddcfb2", 0.9)
MAT["salle_floor"] = make_mat("salle_floor", "#a9743f", 0.5)
MAT["salle_joint"] = make_mat("salle_joint", "#7c5228", 0.6)
MAT["salle_wain"] = make_mat("salle_wain", "#6b4429", 0.6)
MAT["rug"] = make_mat("rug", "#7c2b34", 0.92)
MAT["rug_edge"] = make_mat("rug_edge", "#b08a3a", 0.9)
MAT["banquette"] = make_mat("banquette", "#6a2430", 0.45)
MAT["plant"] = make_mat("plant", "#3f7a44", 0.7)
MAT["plant_pot"] = make_mat("plant_pot", "#b98a52", 0.55)
MAT["gold"] = make_mat("gold", "#c9a349", 0.35, 0.75)
MAT["mirror"] = make_mat("mirror", "#c8d4dc", 0.06, 0.9)
MAT["window_glow"] = make_mat("window_glow", "#ffe9c4", 0.6, 0.0, "#ffd9a0", 1.6)
MAT["sconce"] = make_mat("sconce", "#ffe6bf", 0.4, 0.0, "#ffcf87", 4.0)
for k, art_c in enumerate(("#cbb3d0", "#a9c4b8")):
    MAT[f"art{k}"] = make_mat(f"art{k}", art_c, 0.85)

RX0 = SW + 0.04   # mur d'entrée, côté salle
BX = SW + 5.7     # mur du fond → ~5,6 m de profondeur visible
Z0, Z1 = -0.30, 3.10
CEIL = 3.05
CX, CZ = (RX0 + BX) / 2, (Z0 + Z1) / 2
DEPTH, WIDE = BX - RX0, Z1 - Z0
AXZ = 1.30        # allée centrale, alignée sur le passage

# L'accès à la salle : un PASSAGE OUVERT — fini la porte qui bat dans la
# figure pendant le vol de caméra. Encadrement bois + filet doré côté
# cuisine, portières bordeaux nouées d'or côté salle : on aperçoit la salle
# chaude depuis la cuisine (le mur R3F est percé au même gabarit) et la
# caméra glisse à travers l'arche habillée. Groupe zone_salle = cliquable.
portal = [
    box("salle_jamb_a", SW - 0.02, 1.1, 0.71, 0.07, 2.3, 0.12, MAT["salle_wain"], bevel=0.006),
    box("salle_jamb_b", SW - 0.02, 1.1, 1.91, 0.07, 2.3, 0.12, MAT["salle_wain"], bevel=0.006),
    box("salle_lintel", SW - 0.02, 2.3, 1.31, 0.07, 0.16, 1.32, MAT["salle_wain"], bevel=0.006),
    box("salle_lintel_gold", SW - 0.058, 2.21, 1.31, 0.012, 0.028, 1.18, MAT["gold"], bevel=0),
]
for pz in (0.8, 1.82):
    portal.append(box(f"salle_port_top_{pz}", RX0 + 0.1, 1.75, pz, 0.14, 0.95, 0.18, MAT["rug"], bevel=0.024))
    portal.append(cyl(f"salle_port_tie_{pz}", RX0 + 0.1, 1.22, pz, 0.06, 0.1, MAT["gold"], vertices=12))
    portal.append(box(f"salle_port_low_{pz}", RX0 + 0.1, 0.62, pz, 0.12, 1.14, 0.16, MAT["rug"], bevel=0.024))
join("zone_salle", portal)
sign = text3d("salle_sign", "LA SALLE", 0, 0, 0, 0.07, MAT["copper_text"], extrude=0.002)
sign.location = loc(SW - 0.06, 2.5, 1.31)
sign.rotation_euler = (1.5708, 0, 1.5708)  # face au poste

# Coquille : parquet (lattes filant vers le fond → la perspective se lit),
# murs crème, plafond à caisson. Le mur d'entrée est percé au gabarit porte.
box("salle_floor", CX, 0.002, CZ, DEPTH, 0.024, WIDE, MAT["salle_floor"], bevel=0)
for k, zj in enumerate((-0.06, 0.39, 0.84, 1.76, 2.21, 2.66)):
    box(f"salle_joint_{k}", CX, 0.015, zj, DEPTH - 0.1, 0.004, 0.014, MAT["salle_joint"], bevel=0)
box("salle_back", BX + 0.025, CEIL / 2, CZ, 0.05, CEIL, WIDE, MAT["salle_wall"], bevel=0)
box("salle_side_l", CX, CEIL / 2, Z0 - 0.025, DEPTH, CEIL, 0.05, MAT["salle_wall"], bevel=0)
box("salle_side_r", CX, CEIL / 2, Z1 + 0.025, DEPTH, CEIL, 0.05, MAT["salle_wall"], bevel=0)
box("salle_ceil", CX, CEIL + 0.02, CZ, DEPTH + 0.1, 0.04, WIDE + 0.1, MAT["salle_wall"], bevel=0)
box("salle_ceil_panel", CX, CEIL - 0.005, CZ, DEPTH - 1.4, 0.02, WIDE - 1.2, MAT["salle_wall2"], bevel=0)
box("salle_front_a", RX0, 1.1, (Z0 + 0.71) / 2, 0.05, 2.2, 0.71 - Z0, MAT["salle_wall"], bevel=0)
box("salle_front_b", RX0, 1.1, (1.91 + Z1) / 2, 0.05, 2.2, Z1 - 1.91, MAT["salle_wall"], bevel=0)
box("salle_front_top", RX0, (2.2 + CEIL) / 2, CZ, 0.05, CEIL - 2.2, WIDE, MAT["salle_wall"], bevel=0)

# Soubassement bois + cimaise dorée sur le pourtour
box("salle_wain_l", CX, 0.44, Z0 + 0.02, DEPTH - 0.06, 0.88, 0.04, MAT["salle_wain"], bevel=0)
box("salle_wain_r", CX, 0.44, Z1 - 0.02, DEPTH - 0.06, 0.88, 0.04, MAT["salle_wain"], bevel=0)
box("salle_wain_b", BX - 0.02, 0.44, CZ, 0.04, 0.88, WIDE - 0.06, MAT["salle_wain"], bevel=0)
box("salle_rail_l", CX, 0.9, Z0 + 0.03, DEPTH - 0.06, 0.03, 0.02, MAT["gold"], bevel=0)
box("salle_rail_r", CX, 0.9, Z1 - 0.03, DEPTH - 0.06, 0.03, 0.02, MAT["gold"], bevel=0)
box("salle_rail_b", BX - 0.03, 0.9, CZ, 0.02, 0.03, WIDE - 0.06, MAT["gold"], bevel=0)

# Pilastres + chapiteaux dorés : rythment les murs en travées
for k, px in enumerate((4.6, 6.0, 7.4)):
    for s_, zc in ((0, Z0 + 0.055), (1, Z1 - 0.055)):
        box(f"salle_pil_{k}_{s_}", px, 1.5, zc, 0.16, 3.0, 0.07, MAT["salle_wall2"], bevel=0.004)
        box(f"salle_cap_{k}_{s_}", px, 2.92, zc, 0.22, 0.06, 0.1, MAT["gold"], bevel=0.004)

# Tapis rouge de l'entrée : file de la porte vers le fond de l'allée
box("salle_run_edge", 5.35, 0.02, AXZ, 4.0, 0.007, 1.0, MAT["rug_edge"], bevel=0)
box("salle_run", 5.35, 0.026, AXZ, 3.9, 0.007, 0.88, MAT["rug"], bevel=0)

# Fenêtres à croisillons (mur gauche) : lueur chaude du soir + rideaux bordeaux
for k, wx in enumerate((5.3, 6.7, 8.1)):
    box(f"salle_winf_{k}", wx, 1.75, Z0 + 0.05, 0.78, 1.5, 0.035, MAT["gold"], bevel=0.004)
    box(f"salle_wing_{k}", wx, 1.75, Z0 + 0.06, 0.68, 1.4, 0.03, MAT["window_glow"], bevel=0)
    box(f"salle_winb_v_{k}", wx, 1.75, Z0 + 0.078, 0.02, 1.4, 0.01, MAT["gold"], bevel=0)
    for j, wy in enumerate((1.42, 2.08)):
        box(f"salle_winb_h_{k}_{j}", wx, wy, Z0 + 0.078, 0.68, 0.02, 0.01, MAT["gold"], bevel=0)
    for s_ in (-1, 1):
        box(f"salle_curt_{k}_{s_}", wx + s_ * 0.5, 1.3, Z0 + 0.09, 0.16, 2.5, 0.07, MAT["rug"], bevel=0.012)
    box(f"salle_pelmet_{k}", wx, 2.6, Z0 + 0.09, 1.2, 0.14, 0.08, MAT["rug"], bevel=0.012)

# Tableaux dorés + miroir rond (mur droit, au-dessus de la banquette)
for k, px in enumerate((5.3, 6.7)):
    box(f"salle_artf_{k}", px, 1.85, Z1 - 0.055, 0.7, 0.55, 0.035, MAT["gold"], bevel=0.004)
    box(f"salle_art_{k}", px, 1.85, Z1 - 0.065, 0.6, 0.45, 0.03, MAT[f"art{k}"], bevel=0)
cyl("salle_rndf", 8.1, 1.85, Z1 - 0.06, 0.26, 0.035, MAT["gold"], axis="z", vertices=28)
cyl("salle_rnd", 8.1, 1.85, Z1 - 0.075, 0.215, 0.03, MAT["mirror"], axis="z", vertices=28)

# Banquette bordeaux le long du mur droit + ses deux tables nappées
box("salle_banq_base", 6.05, 0.17, Z1 - 0.21, 3.1, 0.34, 0.34, MAT["salle_wain"], bevel=0.006)
box("salle_banq_seat", 6.05, 0.39, Z1 - 0.23, 3.14, 0.1, 0.42, MAT["banquette"], bevel=0.02)
box("salle_banq_back", 6.05, 0.74, Z1 - 0.085, 3.14, 0.72, 0.09, MAT["banquette"], bevel=0.02)


def salle_chair(tag, x, z, bx_, bz_):
    """Chaise bistrot : assise + dossier (décalé de (bx_, bz_)) + 4 pieds."""
    parts = [box(f"chair_seat_{tag}", x, 0.45, z, 0.36, 0.045, 0.36, MAT["salle_wain"], bevel=0.012)]
    parts.append(box(
        f"chair_back_{tag}", x + bx_ * 0.165, 0.73, z + bz_ * 0.165,
        0.05 if bx_ else 0.36, 0.52, 0.36 if bx_ else 0.05,
        MAT["salle_wain"], bevel=0.012))
    for sx in (-1, 1):
        for sz in (-1, 1):
            parts.append(cyl(f"chair_leg_{tag}_{sx}_{sz}", x + sx * 0.15, 0.215, z + sz * 0.15, 0.014, 0.43, MAT["salle_wain"], vertices=8))
    return join(f"salle_chair_{tag}", parts)


for k, tx in enumerate((5.3, 6.7)):
    box(f"salle_bt_skirt_{k}", tx, 0.36, 2.38, 0.56, 0.68, 0.54, MAT["tablecloth"], bevel=0.01)
    box(f"salle_bt_top_{k}", tx, 0.71, 2.38, 0.66, 0.035, 0.64, MAT["tablecloth"], bevel=0.012)
    cyl(f"salle_bt_plate_{k}", tx, 0.735, 2.38, 0.075, 0.008, MAT["porcelain"], vertices=22)
    cyl(f"salle_bt_candle_{k}", tx + 0.2, 0.76, 2.38, 0.013, 0.07, MAT["porcelain"], vertices=10)
    sphere(f"salle_bt_flame_{k}", tx + 0.2, 0.805, 2.38, 0.018, MAT["candle"], subdiv=1)
    cyl(f"salle_bt_gstem_{k}", tx - 0.18, 0.755, 2.38, 0.005, 0.07, MAT["glass"], vertices=8)
    cone(f"salle_bt_gbowl_{k}", tx - 0.18, 0.815, 2.38, 0.03, 0.02, 0.055, MAT["glass"], vertices=12)
    salle_chair(f"b{k}", tx, 2.0, 0, -1)

# Tables rondes dressées côté fenêtres (nappe longue, couverts, bougie)
for k, (tx, tz) in enumerate(((5.85, 0.5), (7.5, 0.55))):
    cyl(f"salle_tfoot_{k}", tx, 0.025, tz, 0.17, 0.035, MAT["gold"], vertices=18)
    cyl(f"salle_tpied_{k}", tx, 0.37, tz, 0.035, 0.66, MAT["gold"], vertices=12)
    cyl(f"salle_skirt_{k}", tx, 0.4, tz, 0.3, 0.64, MAT["tablecloth"], vertices=24)
    cyl(f"salle_cloth_{k}", tx, 0.735, tz, 0.37, 0.025, MAT["tablecloth"], vertices=28)
    for s_ in (-1, 1):
        cyl(f"salle_plate_{k}_{s_}", tx + s_ * 0.17, 0.752, tz, 0.078, 0.008, MAT["porcelain"], vertices=22)
        cyl(f"salle_plate2_{k}_{s_}", tx + s_ * 0.17, 0.757, tz, 0.042, 0.005, MAT["gold"], vertices=16)
    cyl(f"salle_candle_{k}", tx, 0.775, tz, 0.013, 0.08, MAT["porcelain"], vertices=10)
    sphere(f"salle_flame_{k}", tx, 0.825, tz, 0.018, MAT["candle"], subdiv=1)
    for gsn in (-1, 1):
        cyl(f"salle_gstem_{k}_{gsn}", tx + gsn * 0.05, 0.76, tz + 0.2, 0.005, 0.07, MAT["glass"], vertices=8)
        cone(f"salle_gbowl_{k}_{gsn}", tx + gsn * 0.05, 0.82, tz + 0.2, 0.03, 0.02, 0.055, MAT["glass"], vertices=12)
    salle_chair(f"r{k}a", tx - 0.6, tz, -1, 0)
    # T1 (k=0) libère le côté allée : le guéridon à dessert y prend place,
    # présenté par le bras ouvert du maître d'hôtel
    if k:
        salle_chair(f"r{k}b", tx + 0.6, tz, 1, 0)

# Trois lustres dorés suspendus BAS au-dessus des TABLES (pas de l'allée :
# l'axe reste dégagé pour lire l'enseigne du fond) — flaques de lumière
# chaude sur les nappes, longues chaînes élégantes
for k, (cx_, cz_) in enumerate(((5.85, 0.5), (7.5, 0.55), (6.0, 2.38))):
    cyl(f"salle_chain_{k}", cx_, 2.58, cz_, 0.008, 0.94, MAT["dark_metal"], vertices=8)
    cyl(f"salle_lustre_{k}", cx_, 2.1, cz_, 0.16, 0.03, MAT["gold"], vertices=22)
    sphere(f"salle_lustre_b_{k}", cx_, 2.05, cz_, 0.05, MAT["gold"], subdiv=1)
    for b in range(6):
        a = b * 1.0472
        lbx, lbz = cx_ + 0.125 * math.cos(a), cz_ + 0.125 * math.sin(a)
        cyl(f"salle_bougie_{k}_{b}", lbx, 2.15, lbz, 0.011, 0.06, MAT["porcelain"], vertices=8)
        sphere(f"salle_bulb_{k}_{b}", lbx, 2.195, lbz, 0.026, MAT["pendant_glow"], subdiv=1)

# Le fond de perspective : buffet à bouteilles, grand miroir doré, enseigne
# « LE POSTE », appliques et plantes en pot dans les coins
box("salle_buffet", 8.66, 0.5, CZ, 0.42, 1.0, 2.0, MAT["salle_wain"], bevel=0.008)
box("salle_buffet_top", 8.64, 1.02, CZ, 0.48, 0.04, 2.1, MAT["wood"], bevel=0.006)
for k, (bz_, mt) in enumerate(((0.75, "bottle_vin"), (1.05, "bottle_oil"), (1.4, "wine"), (1.75, "bottle_vin"), (2.05, "wine"))):
    cyl(f"salle_btl_{k}", 8.68, 1.15, bz_, 0.03, 0.22, MAT[mt], vertices=12)
# Grand tableau (paysage naïf : ciel crème, soleil doré, collines) — un vrai
# miroir ne refléterait que l'envmap sombre de la cuisine (effet ardoise)
MAT["tab_sky"] = make_mat("tab_sky", "#e8d9b8", 0.9)
MAT["tab_hill"] = make_mat("tab_hill", "#77804d", 0.85)
MAT["tab_hill2"] = make_mat("tab_hill2", "#55603a", 0.85)
MAT["tab_sun"] = make_mat("tab_sun", "#d9a441", 0.6)
box("salle_mirf", BX - 0.035, 1.85, CZ, 0.04, 1.35, 1.75, MAT["gold"], bevel=0.006)
box("salle_tab", BX - 0.055, 1.85, CZ, 0.02, 1.21, 1.61, MAT["tab_sky"], bevel=0)
box("salle_tab_h1", BX - 0.062, 1.58, CZ, 0.012, 0.36, 1.52, MAT["tab_hill"], bevel=0)
box("salle_tab_h2", BX - 0.066, 1.44, CZ, 0.012, 0.2, 1.52, MAT["tab_hill2"], bevel=0)
cyl("salle_tab_sun", BX - 0.068, 2.12, 1.0, 0.14, 0.012, MAT["tab_sun"], axis="x", vertices=22)
# L'enseigne du fond : l'engagement derrière le formulaire de réservation
nom = text3d("salle_nom", "PRÊT POUR L'AVENTURE ?", 0, 0, 0, 0.125, MAT["gold"], extrude=0.004)
nom.location = loc(BX - 0.07, 2.86, CZ)
nom.rotation_euler = (1.5708, 0, -1.5708)
sub = text3d("salle_nom_sub", "une réservation, une réponse sous 24 h — promis", 0, 0, 0, 0.048, MAT["copper_text"], extrude=0.002)
sub.location = loc(BX - 0.07, 2.68, CZ)
sub.rotation_euler = (1.5708, 0, -1.5708)
for k, sz_ in enumerate((0.32, 2.48)):
    cyl(f"salle_sconce_{k}", BX - 0.07, 1.95, sz_, 0.05, 0.07, MAT["gold"], axis="x", vertices=12)
    sphere(f"salle_sconce_glow_{k}", BX - 0.13, 1.98, sz_, 0.05, MAT["sconce"], scale=(0.7, 1, 1))
for k, (plx, plz) in enumerate(((8.4, 0.08), (8.4, 2.72))):
    plant = [cyl(f"plant_pot_{k}", plx, 0.19, plz, 0.14, 0.36, MAT["plant_pot"], vertices=16)]
    for lx, ly, lz in [(0, 0.58, 0), (0.12, 0.48, 0.06), (-0.11, 0.5, -0.06), (0.06, 0.64, -0.08), (-0.07, 0.55, 0.1)]:
        plant.append(sphere(f"plant_leaf_{k}_{lx}_{lz}", plx + lx, 0.19 + ly, plz + lz, 0.15, MAT["plant"], scale=(0.55, 1.7, 0.55)))
    join(f"salle_plant_{k}", plant)

# Porte-manteau à l'entrée (coin droit)
cyl("vest_pole", 3.9, 0.85, 2.75, 0.022, 1.66, MAT["salle_wain"], vertices=10)
cyl("vest_foot", 3.9, 0.02, 2.75, 0.14, 0.04, MAT["salle_wain"], vertices=14)
sphere("vest_top", 3.9, 1.7, 2.75, 0.03, MAT["gold"], subdiv=1)
cyl("vest_arm_0", 3.9, 1.58, 2.75, 0.012, 0.34, MAT["gold"], axis="x", vertices=8)
cyl("vest_arm_1", 3.9, 1.52, 2.75, 0.012, 0.34, MAT["gold"], axis="z", vertices=8)

# Pupitre d'accueil : podium bois, menu ouvert, lampe laiton, plaque dorée.
# Posé en tête du tapis rouge → il cadre le premier plan gauche et le
# chevalet RÉSERVATIONS reste dans le champ du POI.
HX, HZ = 4.55, 1.0
frustum("host_body", HX, 0.03, HZ, 0.3, 0.26, 0.42, 0.34, 1.0, MAT["salle_wain"])
box("host_top", HX, 1.05, HZ, 0.48, 0.035, 0.4, MAT["wood"], bevel=0.008)
box("host_menu_l", HX, 1.085, HZ - 0.065, 0.26, 0.012, 0.13, MAT["leather"], rot=(-0.32, 0, 0), bevel=0)
box("host_menu_r", HX, 1.085, HZ + 0.065, 0.26, 0.012, 0.13, MAT["leather"], rot=(0.32, 0, 0), bevel=0)
box("host_page_l", HX, 1.093, HZ - 0.062, 0.23, 0.008, 0.11, MAT["paper"], rot=(-0.32, 0, 0), bevel=0)
box("host_page_r", HX, 1.093, HZ + 0.062, 0.23, 0.008, 0.11, MAT["paper"], rot=(0.32, 0, 0), bevel=0)
# La lampe laiton vit sur le BUFFET (sur le pupitre, elle masquait l'ardoise
# du menu du jour depuis le POI)
cyl("host_lamp_stem", 8.64, 1.1, 0.42, 0.008, 0.12, MAT["gold"], vertices=8)
cone("host_lamp_shade", 8.64, 1.18, 0.42, 0.055, 0.025, 0.07, MAT["gold"], vertices=14)
sphere("host_lamp_glow", 8.64, 1.165, 0.42, 0.028, MAT["sconce"], subdiv=1)
# Chevalet doré « RÉSERVATIONS » debout SUR le bord avant du plateau, bien
# DROIT face à l'entrée (-x) — hors du menu, rien ne se traverse
box("host_plaque_base", HX - 0.21, 1.085, HZ, 0.022, 0.035, 0.34, MAT["gold"], bevel=0.004)
plq = text3d("host_plaque", "RÉSERVATIONS", 0, 0, 0, 0.035, MAT["gold"], extrude=0.002)
plq.location = loc(HX - 0.225, 1.128, HZ)
plq.rotation_euler = (1.5708, 0, -1.5708)

# La sonnette d'accueil (coin du pupitre) : cliquable → ding ! (zone_bell)
BLX, BLZ = HX + 0.18, HZ + 0.15
bell = [
    cyl("bell_base", BLX, 1.074, BLZ, 0.05, 0.014, MAT["dark_metal"], vertices=18),
    sphere("bell_dome", BLX, 1.088, BLZ, 0.048, MAT["brass"], scale=(1, 0.72, 1)),
    cyl("bell_btn", BLX, 1.128, BLZ, 0.009, 0.018, MAT["dark_metal"], vertices=8),
]
join("zone_bell", bell)

# Seau à champagne sur pied, au bord de l'allée (cliquable → pop, zone_champ)
champ = [
    cyl("champ_leg", 7.1, 0.36, 0.92, 0.03, 0.68, MAT["gold"], vertices=10),
    cyl("champ_foot", 7.1, 0.02, 0.92, 0.12, 0.03, MAT["gold"], vertices=14),
    cone("champ_bucket", 7.1, 0.78, 0.92, 0.075, 0.105, 0.2, MAT["inox_bright"], vertices=18),
    cyl("champ_bottle", 7.08, 0.95, 0.9, 0.028, 0.19, MAT["bottle_vin"], vertices=12, rot=(0.45, 0, 0.3)),
]
join("zone_champ", champ)

# Ardoise « menu du jour » sur chevalet, entre les deux tables rondes —
# easter egg tech : la stack servie comme des plats
MAT["chalk"] = make_mat("chalk", "#e9e6da", 0.9)
# Les pieds du chevalet restent DERRIÈRE l'ardoise (elle repose devant eux,
# sur la tablette) : rien ne traverse le tableau
cyl("easel_leg_a", 6.6, 0.55, -0.15, 0.014, 1.16, MAT["salle_wain"], vertices=8, rot=(0.14, 0, 0))
cyl("easel_leg_b", 6.6, 0.55, 0.25, 0.014, 1.16, MAT["salle_wain"], vertices=8, rot=(-0.14, 0, 0))
cyl("easel_leg_c", 6.75, 0.55, 0.05, 0.014, 1.16, MAT["salle_wain"], vertices=8, rot=(0, -0.16, 0))
box("easel_board", 6.56, 1.0, 0.05, 0.025, 0.64, 0.54, MAT["slate"], bevel=0.006)
box("easel_ledge", 6.535, 0.67, 0.05, 0.035, 0.025, 0.46, MAT["salle_wain"], bevel=0.004)
for k, (line, sz) in enumerate((("MENU DU JOUR", 0.036), ("React rôti", 0.044), ("Node au jus", 0.044), ("SQL flambé", 0.044))):
    tt = text3d(f"easel_txt_{k}", line, 0, 0, 0, sz, MAT["chalk"], extrude=0.001)
    tt.location = loc(6.54, 1.24 - k * 0.125, 0.05)
    tt.rotation_euler = (1.5708, 0, -1.5708)

# Guéridon de service à côté du maître d'hôtel : son bras ouvert PRÉSENTE le
# plateau à dessert sous cloche — bien en vue au premier plan de l'allée
GDX, GDZ = 6.42, 0.55
cyl("gueridon_foot", GDX, 0.02, GDZ, 0.13, 0.035, MAT["salle_wain"], vertices=14)
cyl("gueridon_pied", GDX, 0.36, GDZ, 0.03, 0.68, MAT["salle_wain"], vertices=10)
cyl("gueridon_top", GDX, 0.72, GDZ, 0.19, 0.03, MAT["wood"], vertices=20)
cyl("cake_foot", GDX, 0.75, GDZ, 0.035, 0.035, MAT["porcelain"], vertices=14)
cyl("cake_plate", GDX, 0.777, GDZ, 0.095, 0.012, MAT["porcelain"], vertices=22)
cyl("cake", GDX, 0.81, GDZ, 0.05, 0.05, MAT["plant_pot"], vertices=16)
sphere("cake_dome", GDX, 0.825, GDZ, 0.1, MAT["door_window"], scale=(1, 0.78, 1))
sphere("cake_knob", GDX, 0.91, GDZ, 0.016, MAT["gold"], subdiv=1)

# Le CANARD DORÉ, cousin chic du canard de debug (cliquable → coin coin)
duck2 = [
    sphere("duck2_body", 8.66, 1.082, 2.28, 0.05, MAT["gold"], scale=(1.15, 0.85, 1)),
    sphere("duck2_head", 8.625, 1.14, 2.28, 0.03, MAT["gold"]),
    box("duck2_beak", 8.59, 1.135, 2.28, 0.022, 0.012, 0.02, MAT["tab_sun"], bevel=0.002),
    sphere("duck2_tail", 8.705, 1.1, 2.28, 0.02, MAT["gold"], scale=(1.2, 0.7, 0.8), subdiv=1),
]
join("zone_duck2", duck2)

# Un des tableaux devient un « </> » encadré d'or (l'art selon un dev)
code = text3d("salle_art_code", "</>", 0, 0, 0, 0.14, MAT["copper_text"], extrude=0.003)
code.location = loc(6.7, 1.85, Z1 - 0.088)
code.rotation_euler = (1.5708, 0, 3.1416)

# Carton « RÉSERVÉ » sur la première table — cette table attend votre projet
box("t1_card", 5.75, 0.78, 0.32, 0.012, 0.07, 0.12, MAT["paper"], bevel=0.002)
rsv = text3d("t1_card_txt", "RÉSERVÉ", 0, 0, 0, 0.022, MAT["ink"], extrude=0.001)
rsv.location = loc(5.742, 0.785, 0.32)
rsv.rotation_euler = (1.5708, 0, -1.5708)

# Le maître d'hôtel (face à l'entrée, -x) : vraie silhouette — jambes,
# chaussures, plastron blanc sous gilet cintré, nœud pap, visage (yeux, nez,
# moustache), bras d'accueil ouvert et torchon plié sur l'avant-bras.
MAT["waiter_suit"] = make_mat("waiter_suit", "#22242c", 0.55)
MAT["waiter_shirt"] = make_mat("waiter_shirt", "#f3efe6", 0.75)
MAT["waiter_skin"] = make_mat("waiter_skin", "#d8a274", 0.6)
MAT["waiter_hair"] = make_mat("waiter_hair", "#2b2018", 0.7)
WX, WZ = 6.5, 1.02
waiter = []
for s_ in (-1, 1):
    waiter.append(box(f"waiter_shoe_{s_}", WX - 0.025, 0.055, WZ + s_ * 0.055, 0.16, 0.05, 0.085, MAT["waiter_suit"], bevel=0.008))
    waiter.append(cyl(f"waiter_leg_{s_}", WX, 0.38, WZ + s_ * 0.055, 0.045, 0.6, MAT["waiter_suit"], vertices=12))
    waiter.append(sphere(f"waiter_shoulder_{s_}", WX + 0.01, 1.13, WZ + s_ * 0.115, 0.05, MAT["waiter_suit"]))
    # pans avant du gilet : ne laissent qu'une étroite bande de plastron blanc
    waiter.append(box(f"waiter_vfront_{s_}", WX - 0.125, 0.89, WZ + s_ * 0.068, 0.02, 0.46, 0.075, MAT["waiter_suit"], bevel=0.004))
# torse : plastron blanc sous un gilet noir cintré (frustums)
waiter.append(frustum("waiter_shirtb", WX, 0.65, WZ, 0.19, 0.14, 0.26, 0.17, 0.5, MAT["waiter_shirt"]))
waiter.append(frustum("waiter_vest", WX + 0.025, 0.66, WZ, 0.21, 0.15, 0.28, 0.18, 0.46, MAT["waiter_suit"]))
waiter += [
    box("waiter_bow", WX - 0.128, 1.115, WZ, 0.018, 0.026, 0.06, MAT["waiter_suit"], bevel=0.004),
    sphere("waiter_btn_0", WX - 0.128, 1.0, WZ, 0.009, MAT["gold"], subdiv=1),
    sphere("waiter_btn_1", WX - 0.122, 0.9, WZ, 0.009, MAT["gold"], subdiv=1),
    cyl("waiter_neck", WX, 1.17, WZ, 0.032, 0.07, MAT["waiter_skin"], vertices=10),
    sphere("waiter_head", WX, 1.31, WZ, 0.095, MAT["waiter_skin"]),
    sphere("waiter_hair", WX + 0.025, 1.348, WZ, 0.095, MAT["waiter_hair"], scale=(0.95, 0.62, 1.05)),
    sphere("waiter_nose", WX - 0.093, 1.3, WZ, 0.014, MAT["waiter_skin"], subdiv=1),
    box("waiter_moustache", WX - 0.089, 1.279, WZ, 0.014, 0.013, 0.058, MAT["waiter_hair"], bevel=0.003),
    sphere("waiter_eye_l", WX - 0.081, 1.334, WZ - 0.036, 0.012, MAT["waiter_hair"], subdiv=1),
    sphere("waiter_eye_r", WX - 0.081, 1.334, WZ + 0.036, 0.012, MAT["waiter_hair"], subdiv=1),
    # bras gauche ouvert en geste d'accueil (vers l'allée), collé à l'épaule
    cyl("waiter_arm_l", WX, 1.0, WZ - 0.19, 0.028, 0.32, MAT["waiter_suit"], vertices=10, rot=(-0.5, 0, 0)),
    sphere("waiter_hand_l", WX, 0.865, WZ - 0.295, 0.026, MAT["waiter_skin"], subdiv=1),
    # bras droit plié, torchon blanc du service sur l'avant-bras
    cyl("waiter_arm_ru", WX + 0.01, 1.02, WZ + 0.13, 0.028, 0.2, MAT["waiter_suit"], vertices=10),
    cyl("waiter_arm_rf", WX - 0.1, 0.93, WZ + 0.13, 0.027, 0.26, MAT["waiter_suit"], axis="x", vertices=10),
    sphere("waiter_hand_r", WX - 0.245, 0.93, WZ + 0.13, 0.026, MAT["waiter_skin"], subdiv=1),
    box("waiter_torchon", WX - 0.14, 0.91, WZ + 0.135, 0.09, 0.17, 0.045, MAT["tablecloth"], bevel=0.006),
]
join("waiter", waiter)

# ---------- l'entrée : cloison + portes battantes au nom du chef ----------

E = L["entry"]
EZ = E["z"]
WH = L["wall"]["h"]
HALF_W = L["wall"]["w"] / 2
OPEN_HALF = E["hingeX"] + 0.02  # demi-largeur de l'ouverture

# Cloison percée de l'ouverture (3 segments : gauche, droite, linteau)
seg_w = HALF_W - OPEN_HALF
box("partition_l", -(OPEN_HALF + seg_w / 2), WH / 2, EZ, seg_w, WH, 0.12, MAT["wall_paint"], bevel=0)
box("partition_r", OPEN_HALF + seg_w / 2, WH / 2, EZ, seg_w, WH, 0.12, MAT["wall_paint"], bevel=0)
box("partition_top", 0, E["doorH"] + 0.07 + (WH - E["doorH"] - 0.07) / 2, EZ,
    OPEN_HALF * 2, WH - E["doorH"] - 0.07, 0.12, MAT["wall_paint"], bevel=0)

# Cadre inox de l'ouverture
frame_parts = [
    box("frame_top", 0, E["doorH"] + 0.045, EZ, OPEN_HALF * 2 + 0.12, 0.07, 0.16, MAT["inox_dark"]),
]
# Montants rapprochés de la charnière : ils couvrent le liseré (hingeX→OPEN_HALF)
# de l'ouverture, sinon on voit à travers sur les côtés quand la porte s'ouvre.
for s in (-1, 1):
    frame_parts.append(box(f"frame_post_{s}", s * (E["hingeX"] + 0.03), (E["doorH"] + 0.08) / 2, EZ + 0.01,
                           0.09, E["doorH"] + 0.08, 0.17, MAT["inox_dark"]))
join("door_frame", frame_parts)

# Enseigne au-dessus des portes (à 2.45 : dans le cadre de la caméra d'entrée)
sign = [box("sign_board", 0, 2.35, EZ + 0.05, 2.0, 0.3, 0.06, MAT["wood_dark"], bevel=0.008)]
sign.append(text3d("sign_text", "CUISINE DU CHEF", 0, 2.35, EZ + 0.085, 0.12, MAT["copper_text"]))
join("sign", sign)

# Portes battantes : l'origine de chaque porte = axe de charnière,
# pour que l'ouverture côté R3F soit un simple node.rotation.y.
for suffix, s in (("L", -1), ("R", 1)):
    cx = s * (E["hingeX"] - E["doorW"] / 2)  # centre du vantail
    parts = [
        # 1er objet = colonne de charnière → son origine devient celle du join
        cyl(f"hinge_{suffix}", s * E["hingeX"], E["doorH"] / 2 + 0.03, EZ, 0.016, E["doorH"], MAT["inox_dark"], vertices=12),
        box(f"panel_{suffix}", cx, E["doorH"] / 2 + 0.03, EZ, E["doorW"], E["doorH"], 0.045, MAT["door_paint"], bevel=0.006),
        # Hublot : anneau + vitre transparente (on voit la cuisine à travers)
        cyl(f"glass_{suffix}", cx, 1.58, EZ, 0.135, 0.052, MAT["door_window"], axis="z", vertices=28),
        # Plaque de propreté basse + poussoir central
        box(f"kick_{suffix}", cx, 0.26, EZ + 0.026, E["doorW"] - 0.08, 0.36, 0.008, MAT["inox_bright"], bevel=0),
        box(f"push_{suffix}", s * 0.1, 1.08, EZ + 0.027, 0.1, 0.34, 0.007, MAT["inox_bright"], bevel=0),
        text3d(f"name_{suffix}", "NOA" if s < 0 else "VELLAT", cx, 1.15, EZ + 0.028, 0.13, MAT["copper_text"]),
    ]
    # Joint caoutchouc central (côté droit) : plus de jour entre les vantaux
    if s > 0:
        parts.append(box(f"seal_{suffix}", 0.0, E["doorH"] / 2 + 0.03, EZ, 0.05, E["doorH"] - 0.02, 0.052, MAT["rubber"], bevel=0))
    # anneau du hublot
    bpy.ops.mesh.primitive_torus_add(major_radius=0.145, minor_radius=0.012,
                                     major_segments=28, minor_segments=8,
                                     location=loc(cx, 1.58, EZ + 0.02))
    ring = bpy.context.active_object
    ring.name = f"ring_{suffix}"
    ring.rotation_euler = (1.5708, 0, 0)
    ring.data.materials.append(MAT["inox_bright"])
    parts.append(ring)
    join(f"door_{suffix}", parts)

# ---------- export ----------

# Export brut → assets-src/ ; la compression meshopt (npm run assets)
# produit le fichier servi : public/models/poste.glb
out = ROOT / "assets-src/poste.glb"
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_apply=True)
print(f"EXPORTED {out} ({out.stat().st_size / 1024:.0f} KB)")
