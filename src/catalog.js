export const MATERIAL_GROUPS = [
  {
    id: "steel",
    label: "Steel",
    items: [
      { id: "STL-CRS", label: "CRS — cold rolled steel", form: "plate" },
      { id: "STL-HRS", label: "HRS — hot rolled steel", form: "plate" },
      { id: "A36", label: "A36 structural plate", form: "plate" },
      { id: "1018", label: "1018 CRS bar / plate", form: "bar" },
      { id: "1045", label: "1045 carbon steel", form: "bar" },
      { id: "4140", label: "4140 alloy steel", form: "bar" },
      { id: "A500", label: "A500 structural tube", form: "square_tube" },
      { id: "STL-TUBE (SQ.)", label: "Steel square tube", form: "square_tube" },
      { id: "STL-TUBE (RECT.)", label: "Steel rect tube", form: "rect_tube" },
      { id: "STL-WELDMENT", label: "Steel weldment / base plate", form: "plate" },
      { id: "AR400", label: "AR400 wear plate", form: "plate" },
      { id: "A2", label: "A2 tool steel", form: "plate" },
      { id: "O1", label: "O1 tool steel", form: "bar" },
    ],
  },
  {
    id: "stainless",
    label: "Stainless",
    items: [
      { id: "304 SS", label: "304 stainless", form: "plate" },
      { id: "316 SS", label: "316 stainless", form: "plate" },
      { id: "303 SS", label: "303 stainless (machining)", form: "bar" },
      { id: "17-4 PH", label: "17-4 PH stainless", form: "bar" },
    ],
  },
  {
    id: "aluminum",
    label: "Aluminum",
    items: [
      { id: "AL-6061", label: "6061-T6 aluminum", form: "plate" },
      { id: "AL-5052", label: "5052 aluminum (sheet / brake)", form: "sheet" },
      { id: "AL-7075", label: "7075-T6 aluminum", form: "plate" },
      { id: "AL-T&J", label: "MIC6 / tool & jig plate", form: "plate" },
      { id: "ALUM EXTRUSION", label: "Aluminum extrusion", form: "extrusion" },
      { id: "ALUM ANGLE", label: "Aluminum angle", form: "angle" },
      { id: "80/20 1010", label: "80/20 1010 profile", form: "extrusion" },
      { id: "80/20 1515", label: "80/20 1515 profile", form: "extrusion" },
      { id: "80/20 1530", label: "80/20 1530 profile", form: "extrusion" },
    ],
  },
  {
    id: "plastic",
    label: "Plastics",
    items: [
      { id: "UHMW", label: "UHMW", form: "plate" },
      { id: "DELRIN", label: "Delrin / acetal", form: "plate" },
      { id: "NYLON", label: "Nylon", form: "plate" },
      { id: "POLYCARBONATE", label: "Polycarbonate", form: "sheet" },
      { id: "ACRYLIC", label: "Acrylic", form: "sheet" },
      { id: "ABS", label: "ABS sheet", form: "sheet" },
      { id: "HDPE", label: "HDPE", form: "plate" },
      { id: "PTFE", label: "PTFE / Teflon", form: "plate" },
      { id: "PVC", label: "PVC", form: "sheet" },
      { id: "PEEK", label: "PEEK", form: "plate" },
    ],
  },
  {
    id: "printed",
    label: "3D printed",
    items: [
      { id: "PLA", label: "PLA filament / printed stock", form: "other" },
      { id: "PETG", label: "PETG", form: "other" },
      { id: "ABS-PRINT", label: "ABS (printed)", form: "other" },
      { id: "ASA", label: "ASA (outdoor printed)", form: "other" },
      { id: "TPU", label: "TPU (flex)", form: "other" },
      { id: "NYLON-12", label: "Nylon 12 (printed)", form: "other" },
      { id: "CF-FILL", label: "Carbon-fiber filled print", form: "other" },
      { id: "SLA-RESIN", label: "SLA / resin", form: "other" },
    ],
  },
  {
    id: "other",
    label: "Other metals & stock",
    items: [
      { id: "BRASS", label: "Brass", form: "bar" },
      { id: "BRONZE", label: "Bronze", form: "bar" },
      { id: "COPPER", label: "Copper", form: "bar" },
      { id: "TELESPAR NON-PERF.", label: "Telespar (non-perf)", form: "square_tube" },
      { id: "CRS SHEET", label: "CRS sheet metal", form: "sheet" },
      { id: "GALV SHEET", label: "Galvanized sheet", form: "sheet" },
    ],
  },
];

export const CUSTOM_MATERIAL = "__custom__";

export function familyForMaterial(material) {
  const value = String(material || "").toUpperCase();
  if (
    /PLA|PETG|TPU|SLA|RESIN|FILAMENT|ASA|NYLON-12|CF-FILL|ABS-PRINT|3D|PRINT/.test(value)
  ) {
    return "printed";
  }
  if (
    /UHMW|DELRIN|ACETAL|NYLON|POLYCARB|ACRYLIC|\bABS\b|HDPE|PTFE|TEFLON|PHENOLIC|\bPVC\b|PEEK|PLASTIC/.test(
      value
    )
  ) {
    return "plastic";
  }
  if (/304|316|303|17-4|STAINLESS|\bSS\b/.test(value)) return "stainless";
  if (/AL-|ALUM|6061|5052|7075|80\/20|MIC6|T&J|T & J/.test(value)) return "aluminum";
  if (/STL|STEEL|CRS|HRS|\bA36\b|1018|1045|4140|AR400|\bA2\b|\bO1\b|A500|WELDMENT/.test(value)) {
    return "steel";
  }
  return "other";
}

export function catalogItem(id) {
  for (const group of MATERIAL_GROUPS) {
    const hit = group.items.find((item) => item.id === id);
    if (hit) return { ...hit, family: group.id };
  }
  return null;
}
