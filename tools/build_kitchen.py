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
# Le parcours en post-its qui se suivent, chronologiques et ascendants —
# chaque élément du tableau raconte quelque chose.
PARCOURS = [
    ("2019", "BAC ES"),
    ("2020", "TISSEC"),
    ("2023", "THEODORE"),
    ("2024", "5 MAINS"),
    ("2025", "EPITECH"),
]
POSTIT_XS = [-0.29, -0.145, 0.0, 0.145, 0.29]
POSTIT_YS = [-0.17, -0.095, -0.02, 0.055, 0.13]
postits = [text3d("board_title", "LE PARCOURS", BO["x"], BO["y"] + 0.24, BO["z"] + 0.016, 0.036, MAT["copper_text"], extrude=0.002)]
for i, (year, label) in enumerate(PARCOURS):
    px_, py_ = BO["x"] + POSTIT_XS[i], BO["y"] + POSTIT_YS[i]
    postits.append(box(f"postit_{i}", px_, py_, BO["z"] + 0.014, 0.12, 0.12, 0.004,
                       MAT[f"postit_{i}"], bevel=0, rot=(0, 0.05 - 0.03 * i, 0)))
    postits.append(text3d(f"postit_txt_{i}", f"{year}\n{label}", px_, py_, BO["z"] + 0.019, 0.02, MAT["ink"], extrude=0.001))
    if i < len(PARCOURS) - 1:
        postits.append(text3d(f"postit_arrow_{i}", ">", (POSTIT_XS[i] + POSTIT_XS[i + 1]) / 2 + BO["x"],
                              (POSTIT_YS[i] + POSTIT_YS[i + 1]) / 2 + BO["y"], BO["z"] + 0.016, 0.03,
                              MAT["copper_text"], extrude=0.001))
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
# Chaque bac = une zone interactive (famille de skills), étiquette cuivre en
# façade. Couleurs alignées sur les légumes du billot : tomate=FRONT rouge,
# courgette=BACK vert, citron=DEVOPS jaune, oignon=MERN crème, carotte=SOFT orange.
colors = ["mise_red", "mise_green", "mise_yellow", "mise_cream", "mise_orange"]
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
MAT["laptop_screen"] = make_mat("laptop_screen", "#0c100d", 0.2, 0.0, "#20301f", 1.0)
MAT["duck"] = make_mat("duck", "#2f7fd6", 0.45)  # bleu Epitech, évidemment
MAT["beak"] = make_mat("beak", "#d97b2a", 0.5)
MAT["epitech_blue"] = make_mat("epitech_blue", "#1a72d8", 0.55)
MAT["white_text"] = make_mat("white_text", "#f2f4f8", 0.4, 0.0, "#c8d4e6", 0.4)
MAT["flame"] = make_mat("flame", "#ff9540", 0.6, 0.0, "#ff7a20", 2.0)
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

# Le couteau du chef — objet séparé, animé côté R3F (il hache en boucle)
knife = [
    box("knife_blade", -0.47, BILLOT_TOP + 0.012, 0.1, 0.16, 0.006, 0.03, MAT["inox_bright"], bevel=0, rot=(0, 0, 0.18)),
    box("knife_handle", -0.59, BILLOT_TOP + 0.014, 0.12, 0.085, 0.016, 0.022, MAT["iron"], bevel=0.003, rot=(0, 0, 0.18)),
]
join("knife", knife)

veg_tomato = [sphere("tomato_body", -0.63, BILLOT_TOP + 0.042, 0.18, 0.042, MAT["veg_tomato"], scale=(1, 1, 0.9))]
veg_tomato.append(cyl("tomato_stem", -0.63, BILLOT_TOP + 0.084, 0.18, 0.006, 0.018, MAT["veg_courgette"], vertices=8))
join("zone_veg_0", veg_tomato)

veg_courgette = [cyl("courgette_body", -0.47, BILLOT_TOP + 0.027, 0.25, 0.027, 0.16, MAT["veg_courgette"], axis="x", vertices=16)]
for k, dx in enumerate((0.11, 0.145)):
    veg_courgette.append(cyl(f"courgette_slice_{k}", -0.47 + dx, BILLOT_TOP + 0.026, 0.25, 0.026, 0.007,
                             MAT["veg_courgette_in"], axis="x", vertices=16))
join("zone_veg_1", veg_courgette)

join("zone_veg_2", [sphere("lemon_body", -0.35, BILLOT_TOP + 0.03, 0.28, 0.03, MAT["veg_lemon"], scale=(1.3, 1, 1))])
join("zone_veg_3", [sphere("onion_body", -0.29, BILLOT_TOP + 0.04, 0.16, 0.04, MAT["veg_onion"], scale=(1, 1, 0.9))])

bpy.ops.mesh.primitive_cone_add(radius1=0.022, radius2=0.004, depth=0.15, vertices=12,
                                location=loc(-0.60, BILLOT_TOP + 0.024, 0.28))
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
MAT["oven_glow"] = make_mat("oven_glow", "#ff9540", 0.6, 0.0, "#ff8c3a", 1.6)
sx, sz = PI["x"], PI["z"]
PTOP = PI["h"] + 0.06  # dessus du piano

box("piano_body", sx, PI["h"] / 2, sz, PI["w"], PI["h"], PI["d"], MAT["dark_metal"], bevel=0.008)
box("piano_top", sx, PI["h"] + 0.02, sz, PI["w"] + 0.02, 0.04, PI["d"] + 0.02, MAT["iron"], bevel=0.005)
box("piano_splash", sx, PI["h"] + 0.13, sz - PI["d"] / 2 + 0.02, PI["w"], 0.18, 0.03, MAT["inox_dark"], bevel=0.004)

# 4 feux : grille + anneau de flamme émissif (vacille côté R3F)
for k, (dx, dz) in enumerate(PI["burners"]):
    cyl(f"grate_{k}", sx + dx, PTOP + 0.01, sz + dz, 0.1, 0.018, MAT["iron"], vertices=20)
    cyl(f"flame_{k}", sx + dx, PTOP + 0.022, sz + dz, 0.06, 0.012, MAT["flame"], vertices=16)

# Le four : porte vitrée, poignée cuivre, lueur chaude à l'intérieur
box("oven_frame", sx, 0.42, sz + PI["d"] / 2 - 0.005, 0.74, 0.46, 0.03, MAT["inox_bright"], bevel=0.006)
box("oven_glass", sx, 0.43, sz + PI["d"] / 2 + 0.012, 0.56, 0.3, 0.012, MAT["glass"], bevel=0)
box("oven_glow", sx, 0.43, sz + PI["d"] / 2 - 0.02, 0.5, 0.24, 0.01, MAT["oven_glow"], bevel=0)
cyl("oven_handle", sx, 0.69, sz + PI["d"] / 2 + 0.035, 0.014, 0.62, MAT["copper"], axis="x", vertices=12)

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

# Petite casserole inox (feu arrière-droit) et sauteuse cuivre (feu avant-droit)
cyl("piano_saucepan", sx + PI["burners"][1][0], PTOP + 0.065, sz + PI["burners"][1][1], 0.07, 0.09, MAT["inox_bright"], vertices=22)
cyl("piano_saucepan_handle", sx + PI["burners"][1][0] + 0.14, PTOP + 0.1, sz + PI["burners"][1][1], 0.007, 0.14, MAT["iron"], axis="x", vertices=8)
cyl("piano_pan", sx + PI["burners"][3][0], PTOP + 0.05, sz + PI["burners"][3][1], 0.085, 0.07, MAT["copper_pot"], vertices=24)
cyl("piano_pan_handle", sx + PI["burners"][3][0] + 0.17, PTOP + 0.07, sz + PI["burners"][3][1], 0.008, 0.16, MAT["iron"], axis="x", vertices=8)

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

# ---------- les portes des salles voisines + les salles derrière ----------

SW = L["sideWalls"]["x"]
MAT["screen_cold"] = make_mat("screen_cold", "#183042", 0.3, 0.0, "#2f7db0", 1.4)
MAT["candle"] = make_mat("candle", "#ffcf87", 0.5, 0.0, "#ff9a3c", 3.0)
MAT["pendant_glow"] = make_mat("pendant_glow", "#ffd9a0", 0.5, 0.0, "#ffb066", 2.0)


def room_shell(name, cx, floor_mat, wall_mat, half_x=1.1, z0=0.2, z1=2.4, ceil=2.6):
    """Coquille d'une salle voisine (sol, fond, côtés, plafond) en boîtes fines."""
    zc, zd = (z0 + z1) / 2, z1 - z0
    box(f"{name}_floor", cx, -0.01, zc, half_x * 2, 0.02, zd, floor_mat, bevel=0)
    box(f"{name}_back", cx + (half_x if cx > 0 else -half_x), ceil / 2, zc, 0.04, ceil, zd, wall_mat, bevel=0)
    box(f"{name}_ceil", cx, ceil, zc, half_x * 2, 0.04, zd, wall_mat, bevel=0)
    box(f"{name}_z0", cx, ceil / 2, z0, half_x * 2, ceil, 0.04, wall_mat, bevel=0)
    box(f"{name}_z1", cx, ceil / 2, z1, half_x * 2, ceil, 0.04, wall_mat, bevel=0)


def side_door(name, sign_text, sgn, panel_mat, hublot=False):
    """Porte battante latérale à charnière (1er objet = charnière → pivot R3F).
    sgn = -1 (gauche, chambre froide) ou +1 (droite, salle)."""
    dx = sgn * (SW - 0.05)
    hinge_z = 0.82  # charnière au bord avant → la porte s'ouvre vers la salle
    parts = [cyl(f"{name}_hinge", dx, 1.05, hinge_z, 0.02, 2.05, MAT["inox_dark"], vertices=10)]
    parts.append(box(f"{name}_panel", dx, 1.05, 1.31, 0.06, 2.0, 0.94, panel_mat, bevel=0.008))
    if hublot:
        parts.append(cyl(f"{name}_hublot_ring", dx - sgn * 0.01, 1.55, 1.31, 0.135, 0.05, MAT["inox_bright"], axis="x", vertices=24))
        parts.append(cyl(f"{name}_hublot", dx - sgn * 0.02, 1.55, 1.31, 0.12, 0.03, MAT["glass"], axis="x", vertices=24))
        parts.append(box(f"{name}_kick", dx - sgn * 0.025, 0.28, 1.31, 0.012, 0.36, 0.82, MAT["inox_bright"], bevel=0))
    else:
        parts.append(box(f"{name}_handle", dx - sgn * 0.06, 1.05, 1.72, 0.05, 0.42, 0.06, MAT["dark_metal"], bevel=0.008))
    door = join(f"zone_{name}", parts)
    # Cadre fixe + enseigne (hors du groupe qui pivote)
    box(f"{name}_frame", sgn * (SW - 0.02), 1.1, 1.31, 0.03, 2.24, 1.16, MAT["inox_dark"], bevel=0)
    sign = text3d(f"{name}_sign", sign_text, 0, 0, 0, 0.07, MAT["copper_text"], extrude=0.002)
    sign.location = loc(sgn * (SW - 0.06), 2.4, 1.31)
    sign.rotation_euler = (1.5708, 0, sgn * 1.5708)  # face au poste
    return door


# CHAMBRE FROIDE (gauche) : galerie des projets — chaque écran = un projet
side_door("froid", "CHAMBRE FROIDE", -1, MAT["inox_bright"])
FX = -(SW + 1.05)  # centre de la salle
room_shell("froid", FX, MAT["frost"], MAT["room_wall"])
box("froid_light", FX, 2.55, 1.3, 1.6, 0.05, 0.12, MAT["screen_cold"], bevel=0)
gx = FX - 0.95  # mur du fond de la chambre
# 6 écrans cliquables (3×2), chacun un projet, avec son numéro gravé
for r in range(2):
    box(f"froid_shelf_{r}", FX, 0.86 + r * 0.72, 1.3, 1.7, 0.03, 0.34, MAT["inox_dark"], bevel=0)
    for c in range(3):
        i = r * 3 + c
        zc = 0.78 + c * 0.52
        screen = [box(f"froid_screen_{i}", gx + 0.03, 1.12 + r * 0.72, zc, 0.02, 0.34, 0.42, MAT["screen_cold"], bevel=0)]
        frame = box(f"froid_scrframe_{i}", gx + 0.015, 1.12 + r * 0.72, zc, 0.015, 0.4, 0.48, MAT["inox_dark"], bevel=0)
        num = text3d(f"froid_num_{i}", f"0{i + 1}", 0, 0, 0, 0.11, MAT["copper_text"], extrude=0.004)
        num.location = loc(gx + 0.05, 1.12 + r * 0.72, zc)
        num.rotation_euler = (1.5708, 0, -1.5708)  # face au poste (+x)
        join(f"zone_screen_{i}", [screen[0], frame, num])
# Ambiance froide : cagettes de bois empilées (les « réserves »)
crate_cols = ["veg_tomato", "veg_courgette", "veg_lemon", "veg_carrot"]
for k in range(4):
    cx, cy, cz = FX + 0.55, 0.14 + (k % 2) * 0.26, 0.7 + (k // 2) * 0.42
    box(f"froid_crate_{k}", cx, cy, cz, 0.34, 0.22, 0.28, MAT["wood_dark"], bevel=0.006)
    box(f"froid_crateveg_{k}", cx, cy + 0.13, cz, 0.28, 0.05, 0.22, MAT[crate_cols[k]], bevel=0)
# Thermomètre au mur (petit détail qui vend la chambre froide)
box("froid_thermo", gx + 0.03, 1.7, 1.95, 0.02, 0.26, 0.05, MAT["porcelain"], bevel=0)
cyl("froid_thermo_bulb", gx + 0.04, 1.58, 1.95, 0.018, 0.02, MAT["veg_tomato"], axis="x", vertices=10)

# LA SALLE (droite) : salle à manger dressée, ardoise, comptoir, lumière chaude
side_door("salle", "SALLE", 1, MAT["door_paint"], hublot=True)
RX = SW + 1.05
bx = RX + 0.95  # mur du fond de la salle
room_shell("salle", RX, MAT["wood_dark"], MAT["leather"])
box("salle_light_bar", RX - 0.3, 2.4, 1.3, 0.04, 0.5, 0.04, MAT["dark_metal"], bevel=0)
cyl("salle_pendant", RX - 0.3, 2.12, 1.3, 0.12, 0.14, MAT["pendant_glow"], vertices=16)
# Ardoise du menu, au mur du fond
box("salle_ardoise_frame", bx - 0.03, 1.6, 1.3, 0.02, 0.72, 0.92, MAT["wood_dark"], bevel=0.006)
box("salle_ardoise", bx - 0.05, 1.6, 1.3, 0.015, 0.64, 0.84, MAT["slate"], bevel=0)
mm = text3d("salle_menu_t", "MENU DU JOUR", 0, 0, 0, 0.07, MAT["white_text"], extrude=0.002)
mm.location = loc(bx - 0.06, 1.86, 1.3)
mm.rotation_euler = (1.5708, 0, 1.5708)  # face au poste (-x)
for li, txt in enumerate(["- Front croustillant", "- Back mijote", "- DevOps flambe", "- Projets maison"]):
    line = text3d(f"salle_menu_{li}", txt, 0, 0, 0, 0.032, MAT["white_text"], extrude=0.001)
    line.location = loc(bx - 0.06, 1.66 - li * 0.13, 1.3)
    line.rotation_euler = (1.5708, 0, 1.5708)
# Comptoir / bar le long du mur avant
box("salle_bar", RX, 0.5, 2.28, 1.5, 1.0, 0.32, MAT["wood_dark"], bevel=0.008)
box("salle_bar_top", RX, 1.02, 2.28, 1.6, 0.05, 0.4, MAT["wood"], bevel=0.006)
for k, tz in enumerate((0.8, 1.7)):
    cyl(f"salle_tpied_{k}", RX, 0.35, tz, 0.04, 0.7, MAT["dark_metal"], vertices=12)
    cyl(f"salle_ttop_{k}", RX, 0.71, tz, 0.32, 0.02, MAT["wood"], vertices=28)
    sphere(f"salle_cloth_{k}", RX, 0.66, tz, 0.34, MAT["tablecloth"], scale=(1, 0.35, 1))
    cyl(f"salle_plate_{k}", RX, 0.735, tz, 0.1, 0.01, MAT["porcelain"], vertices=22)
    cyl(f"salle_candle_{k}", RX - 0.16, 0.76, tz, 0.015, 0.07, MAT["porcelain"], vertices=10)
    sphere(f"salle_flame_{k}", RX - 0.16, 0.81, tz, 0.02, MAT["candle"])
    cyl(f"salle_wine_{k}", RX + 0.17, 0.83, tz, 0.035, 0.22, MAT["wine"], vertices=14)
    # verres à pied
    for gsn in (-1, 1):
        cyl(f"salle_glass_stem_{k}_{gsn}", RX + 0.1, 0.77, tz + gsn * 0.12, 0.004, 0.06, MAT["glass"], vertices=8)
        cone(f"salle_glass_bowl_{k}_{gsn}", RX + 0.1, 0.82, tz + gsn * 0.12, 0.028, 0.02, 0.05, MAT["glass"], vertices=12)
    for s_ in (-1, 1):
        box(f"salle_seat_{k}_{s_}", RX + s_ * 0.02, 0.42, tz + s_ * 0.42, 0.34, 0.04, 0.32, MAT["wood_dark"], bevel=0.004)
        box(f"salle_back_{k}_{s_}", RX + s_ * 0.17, 0.62, tz + s_ * 0.42, 0.04, 0.42, 0.32, MAT["wood_dark"], bevel=0.004)

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
