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
from pathlib import Path

import bpy
import bmesh

ROOT = Path(__file__).resolve().parent.parent
L = json.loads((ROOT / "src/scene/layout.json").read_text())

bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------- conversions three.js <-> Blender ----------

def loc(x, y, z):
    return (x, -z, y)


def dim(w, h, d):
    return (w, d, h)


def srgb(hexcode):
    h = hexcode.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


# ---------- matériaux ----------

def make_mat(name, color, rough=0.5, metal=0.0, emissive=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*srgb(color), 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
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
    "mise_green": make_mat("mise_green", "#5a8a3c", 0.6),
    "mise_red": make_mat("mise_red", "#a83c2e", 0.6),
    "mise_yellow": make_mat("mise_yellow", "#d8b84a", 0.6),
    "mise_cream": make_mat("mise_cream", "#e6dcc4", 0.6),
    "mise_orange": make_mat("mise_orange", "#c9762e", 0.6),
    # Lettres : cuivre clair peu métallique + légère émission → lisibles dans
    # la pénombre (le cuivre metalness 1.0 vire au noir sans reflets à capter)
    "copper_text": make_mat("copper_text", "#d08a45", 0.35, 0.55, "#7a3f12", 0.5),
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


# ---------- le poste ----------

C, W = L["counter"], L["worktop"]
TOP_Y = C["h"] + W["t"]  # dessus du plan de travail

box("counter_body", 0, C["h"] / 2, 0, C["w"], C["h"], C["d"], MAT["inox"])
box("worktop", 0, C["h"] + W["t"] / 2, 0, W["w"], W["t"], W["d"], MAT["inox_bright"])

B = L["billot"]
box("billot", B["x"], TOP_Y + B["t"] / 2, B["z"], B["w"], B["t"], B["d"], MAT["wood"], bevel=0.008)

# Tiroirs (zones Projets) : 2 rangées de 3, un tiroir par projet.
# Origine de l'objet = centre de la façade, pour que l'animation de
# coulissement côté R3F soit un simple position.z.
D = L["drawers"]
for i in range(len(D["cols"]) * len(D["rows"])):
    x = D["cols"][i % 3]
    y = D["rows"][i // 3]
    front = box(f"front_{i}", x, y, D["z"], D["w"], D["h"], 0.04, MAT["inox_bright"])
    handle = cyl(f"handle_{i}", x, y + 0.08, D["z"] + 0.032, 0.012, 0.24, MAT["copper"], axis="x", vertices=12)
    caisson = box(f"caisson_{i}", x, y - 0.02, D["z"] - 0.16, D["w"] - 0.05, D["h"] - 0.07, 0.28, MAT["dark_metal"], bevel=0)
    # Bon de commande posé au fond du tiroir, visible à l'ouverture
    slip = box(f"drawslip_{i}", x, y + 0.078, D["z"] - 0.14, 0.4, 0.004, 0.18, MAT["paper"], bevel=0, rot=(0, 0.04 - 0.02 * (i % 3), 0))
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

# ---------- tableau de brigade (zone Skills) ----------

BO = L["board"]
box("board_frame", BO["x"], BO["y"], BO["z"] - 0.005, BO["w"] + 0.05, BO["h"] + 0.05, 0.02, MAT["wood_dark"])
box("zone_board", BO["x"], BO["y"], BO["z"] + 0.006, BO["w"], BO["h"], 0.012, MAT["slate"], bevel=0)
slips = []
for i, (sx, sy, a) in enumerate([
    (-0.22, 0.16, 0.03), (0.02, 0.17, -0.02), (0.24, 0.14, 0.05),
    (-0.2, -0.02, -0.04), (0.06, -0.04, 0.02), (-0.24, -0.18, 0.03), (0.18, -0.18, -0.03),
]):
    slips.append(box(f"slip_{i}", BO["x"] + sx, BO["y"] + sy, BO["z"] + 0.016, 0.14, 0.09, 0.003,
                     MAT["paper"], bevel=0, rot=(0, -a, 0)))
join("board_slips", slips)

# ---------- étagère + livre (zone About) ----------

S, BK = L["shelf"], L["book"]
plank_top = S["y"] + 0.0175
box("shelf_plank", S["x"], S["y"], S["z"], S["w"], 0.035, S["d"], MAT["wood"], bevel=0.006)
jars = []
for k, dx in enumerate((-0.3, -0.17)):
    jars.append(cyl(f"jar_{k}", S["x"] + dx, plank_top + 0.065, S["z"], 0.045, 0.13, MAT["jar"], vertices=16))
    jars.append(cyl(f"jarlid_{k}", S["x"] + dx, plank_top + 0.137, S["z"], 0.046, 0.014, MAT["copper"], vertices=16))
join("jars", jars)

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
# Chaque bac = une zone interactive (famille de skills), étiquette cuivre en façade
colors = ["mise_green", "mise_red", "mise_yellow", "mise_cream", "mise_orange"]
bac_names = ["FRONT", "BACK", "DEVOPS", "MERN", "SOFT"]
n = SA["bacs"]
usable = SA["w"] - 0.06
step = usable / n
bac_labels = []
for i in range(n):
    bx = SA["x"] - usable / 2 + step * (i + 0.5)
    rim = box(f"bacrim_{i}", bx, sal_top + 0.008, SA["z"], step - 0.02, 0.016, SA["d"] - 0.06, MAT["bac_rim"], bevel=0)
    content = box(f"mise_{i}", bx, sal_top + 0.02, SA["z"], step - 0.045, 0.02, SA["d"] - 0.085, MAT[colors[i % len(colors)]], bevel=0)
    join(f"zone_bac_{i}", [rim, content])
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
MAT["door_paint"] = make_mat("door_paint", "#454b52", 0.6, 0.15)
MAT["wall_paint"] = make_mat("wall_paint", "#2b3036", 0.85)
MAT["glass"] = make_mat("glass", "#12161a", 0.08, 0.4)
MAT["rubber"] = make_mat("rubber", "#17181b", 0.85)

RAIL_Z = -0.41  # barres murales, 4 cm devant le mur


def rail(name, x0, x1, y):
    parts = [cyl(f"{name}_bar", (x0 + x1) / 2, y, RAIL_Z, 0.011, x1 - x0, MAT["inox_dark"], axis="x", vertices=12)]
    for k, xe in enumerate((x0 + 0.03, x1 - 0.03)):
        parts.append(cyl(f"{name}_mount_{k}", xe, y, -0.432, 0.008, 0.045, MAT["inox_dark"], axis="z", vertices=10))
    return parts


def hook(name, x, y_rail):
    return cyl(name, x, y_rail - 0.027, RAIL_Z, 0.0045, 0.055, MAT["iron"], vertices=8)


# Casseroles en cuivre suspendues par ordre décroissant, fond face au spectateur,
# queue en fonte inclinée — la batterie typique de la cuisine française.
POT_RAIL_Y = 1.62
pots = rail("potrail", 1.3, 2.12, POT_RAIL_Y)
px = 1.42
sizes = [0.105, 0.09, 0.078, 0.066]
for i, r in enumerate(sizes):
    cy = POT_RAIL_Y - 0.05 - r
    pots.append(hook(f"pot_hook_{i}", px, POT_RAIL_Y))
    pots.append(cyl(f"pot_{i}", px, cy, -0.365, r, 0.085, MAT["copper_pot"], axis="z", vertices=28))
    pots.append(cyl(f"pot_rim_{i}", px, cy, -0.322, r + 0.006, 0.014, MAT["copper_pot"], axis="z", vertices=28))
    th = 0.35 + 0.06 * i  # inclinaison légèrement différente par casserole
    pots.append(cyl(
        f"pot_handle_{i}",
        px + (r + 0.08) * math.sin(th), cy - (r + 0.08) * math.cos(th), -0.365,
        0.009, 0.17, MAT["iron"], rot=(0, -th, 0), vertices=10,
    ))
    if i + 1 < len(sizes):
        px += r + sizes[i + 1] + 0.04
join("copper_pots", pots)

# Barre d'ustensiles : louche, écumoire, spatule bois, fouet
UT_RAIL_Y = 1.58
UZ = -0.4
ut = rail("utrail", -1.98, -1.28, UT_RAIL_Y)

ut.append(hook("louche_hook", -1.86, UT_RAIL_Y))
ut.append(cyl("louche_handle", -1.86, 1.425, UZ, 0.006, 0.24, MAT["inox_bright"], rot=(0, -0.05, 0), vertices=10))
ut.append(sphere("louche_bowl", -1.87, 1.29, UZ, 0.042, MAT["inox_bright"], scale=(1, 1, 0.62)))

ut.append(hook("ecumoire_hook", -1.66, UT_RAIL_Y))
ut.append(cyl("ecumoire_handle", -1.66, 1.425, UZ, 0.006, 0.24, MAT["inox_bright"], rot=(0, 0.04, 0), vertices=10))
ut.append(cyl("ecumoire_disc", -1.655, 1.29, UZ, 0.046, 0.008, MAT["inox_bright"], axis="z", vertices=24))

ut.append(hook("spatule_hook", -1.47, UT_RAIL_Y))
ut.append(cyl("spatule_handle", -1.47, 1.44, UZ, 0.007, 0.2, MAT["wood"], rot=(0, -0.03, 0), vertices=10))
ut.append(box("spatule_blade", -1.472, 1.3, UZ, 0.055, 0.1, 0.012, MAT["wood"], bevel=0.004))

ut.append(hook("fouet_hook", -1.31, UT_RAIL_Y))
ut.append(cyl("fouet_handle", -1.31, 1.485, UZ, 0.0075, 0.12, MAT["inox_bright"], vertices=10))
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
    ut.append(o)
join("utensils", ut)

# Torchon plié sur sa barre, flanc gauche du poste
tor = [cyl("torchon_rod", -1.135, 0.76, 0.08, 0.008, 0.3, MAT["inox_dark"], axis="z", vertices=10)]
for k, ze in enumerate((0.0, 0.16)):
    tor.append(cyl(f"torchon_mount_{k}", -1.115, 0.76, ze, 0.006, 0.035, MAT["inox_dark"], axis="x", vertices=8))
tor.append(cyl("torchon_fold", -1.135, 0.76, 0.08, 0.018, 0.15, MAT["linen"], axis="z", vertices=12))
tor.append(box("torchon_front", -1.148, 0.645, 0.08, 0.014, 0.24, 0.15, MAT["linen"], bevel=0.004))
tor.append(box("torchon_back", -1.12, 0.665, 0.08, 0.013, 0.19, 0.15, MAT["linen"], bevel=0.004))
join("torchon", tor)

# Accessoires posés : moulin à poivre, saloir, sauteuse cuivre, couteau sur le billot
BT = L["billot"]["t"]
props = [
    cyl("mill_body", -0.02, TOP_Y + 0.058, 0.22, 0.028, 0.115, MAT["wood_dark"], vertices=18),
    cyl("mill_top", -0.02, TOP_Y + 0.125, 0.22, 0.012, 0.02, MAT["iron"], vertices=12),
    cyl("salt_box", 0.1, TOP_Y + 0.026, 0.27, 0.034, 0.052, MAT["wood"], vertices=18),
    cyl("saut_body", 0.34, TOP_Y + 0.034, 0.16, 0.085, 0.068, MAT["copper_pot"], vertices=28),
    cyl("saut_rim", 0.34, TOP_Y + 0.068, 0.16, 0.09, 0.012, MAT["copper_pot"], vertices=28),
    cyl("saut_handle", 0.505, TOP_Y + 0.05, 0.16, 0.009, 0.16, MAT["iron"], axis="x", vertices=10),
    box("knife_blade", -0.36, TOP_Y + BT + 0.006, 0.1, 0.17, 0.006, 0.032, MAT["inox_bright"], bevel=0, rot=(0, 0, 0.32)),
    box("knife_handle", -0.49, TOP_Y + BT + 0.008, 0.145, 0.09, 0.016, 0.022, MAT["iron"], bevel=0.003, rot=(0, 0, 0.32)),
]
join("props_deco", props)

# Plinthe au pied du mur (cache la jonction sol/carrelage)
box("plinth", 0, 0.05, -0.436, L["wall"]["w"], 0.1, 0.028, MAT["iron"], bevel=0)

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
for s in (-1, 1):
    frame_parts.append(box(f"frame_post_{s}", s * (OPEN_HALF + 0.03), (E["doorH"] + 0.08) / 2, EZ,
                           0.07, E["doorH"] + 0.08, 0.16, MAT["inox_dark"]))
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
        # Hublot : anneau + vitre sombre
        cyl(f"glass_{suffix}", cx, 1.58, EZ, 0.135, 0.052, MAT["glass"], axis="z", vertices=28),
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
