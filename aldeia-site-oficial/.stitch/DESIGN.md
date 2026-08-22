---
name: ALDEIA CRM
colors:
  canvas: "#030303"
  surface: "#090909"
  steel: "#181818"
  silver: "#e4e4e7"
  text: "#ffffff"
---

# Design System: ALDEIA CRM

## 1. Visual Theme & Atmosphere

The CRM is a compact, high-contrast dark command center: black canvas,
silver typography, restrained glass surfaces and fine borders. It should feel
operational rather than decorative; density is deliberate and every tab keeps
the same navigation and content hierarchy.

## 2. Color Palette & Roles

- **Obsidian canvas — `#030303`:** page background and negative space.
- **Dark steel — `#090909` / `#181818`:** sidebar, controls and table surfaces.
- **Frosted silver — `rgba(255,255,255,.03-.08)`:** glass cards and hover states.
- **Signal white — `#ffffff`:** primary actions and key headings.
- **Muted silver — `#a1a1aa`:** supporting copy, metadata and inactive controls.
- **Reserved red:** destructive actions only.

## 3. Typography Rules

Use the existing sans-serif family with compact headings, high contrast titles
and muted operational labels. Page titles use tight tracking; labels are small,
uppercase where hierarchy benefits from it, and body copy remains readable at
small dashboard densities.

## 4. Component Stylings

### Navigation

Desktop navigation is a full-height left sidebar organized in the groups
Visão Geral, Produtividade, Inteligência and Sistema. The active item receives
a restrained rounded dark-steel surface; icons and labels remain visible in the
expanded state. The compact state shows only centered icons with tooltips.

### Cards, tables and forms

Cards use dark glass, 16px rounded corners, hairline white borders and subtle
inset highlights. Tables preserve an operational header and compact rows.
Inputs are dark steel with a gentle silver focus ring. Primary actions are
white with black text; destructive actions are dark red, never bright red.

### Domain modules

Dashboard uses metrics, heatmap and ranked portfolio. Kanban preserves five
work columns. Agenda is calendar-first. Portfolio uses editor + preview +
case list. Analytics and Segurança remain dense, readable audit tables.

## 5. Layout Principles

Main content stays centered with a practical maximum width. Topbar, page
context and active tab share one aligned content column. On small screens the
sidebar becomes horizontal navigation, grids collapse and tables may scroll
horizontally rather than clipping data.

## 6. Stitch Generation Notes

Use: “ALDEIA dark operational CRM, monochrome glass, precision dashboard,
compact sidebar, silver hairline borders, black negative space, rounded dark
steel controls.” Do not introduce purple, gradients with saturated colors,
oversized marketing cards or alternate navigation structures.
