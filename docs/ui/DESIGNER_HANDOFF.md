# Designer Handoff – Bespoke UI Components

## Overview

This document lists the components that require visual design.
Accessibility behavior and interaction primitives are handled by Radix/Shadcn.

Design work should focus on layout, spacing, typography, and visual language.

Base tokens already exist:
- denim / pink palette
- semantic surface tokens
- typography: Outfit + DM Sans
- border radius tokens
- spacing tokens

--------------------------------------------------

## 1. Top Navigation

Component: TopNavTabs

Design requirements:
- appearance of main tabs
- appearance of pinned pane shortcuts row
- selected state
- hover state
- focus-visible state
- overflow behavior if many pinned panes

--------------------------------------------------

## 2. Pane Switcher

Component: PaneSwitcher

Design requirements:
- pane row layout
- reorder controls visual language
- selected pane highlight
- hover state
- keyboard focus state

--------------------------------------------------

## 3. Pane Header Controls

Component: PaneHeaderControls

Design requirements:
- layout rhythm of:
  - rename input
  - audience selector
  - region toggles
  - pin button
  - focus mode toggle

States:
- default
- hover
- focus
- disabled

--------------------------------------------------

## 4. Module System

Components:
- ModuleGrid
- ModuleCard
- ModuleHeader
- ModuleLensControl
- AddModuleButton

Design tasks:
- card chrome
- spacing rhythm
- S/M/L module sizing visual grammar
- hover and focus states
- remove module affordance

--------------------------------------------------

## 5. Focus Mode

Components:
- FocusModeToolbar
- FocusModeModuleIconButton
- ModuleDialog chrome

Design tasks:
- icon button style
- toolbar layout
- focus state
- dialog chrome

--------------------------------------------------

## 6. Overview Pages

Components:
- TimelineItemRow
- CalendarGrid
- DayCell
- EventChip
- TaskRow
- StatusPill

Design tasks:
- event chip styling
- task row density
- status pill visual system
- timeline row hierarchy

--------------------------------------------------

## 7. Filters

Components:
- FilterBar
- FilterChip

Design tasks:
- chip appearance
- filter bar layout rhythm
- focus and selected states

--------------------------------------------------

## 8. Notices and Empty States

Components:
- InlineNotice
- EmptyState

Design tasks:
- info/warning/danger/success notice visuals
- empty state layouts

--------------------------------------------------

## 9. Future Surfaces

Components:
- WorkspaceSurfacePlaceholder
- AutomationBuilderShell

Purpose:
Prepare layout language for future complex surfaces (Lexical workspace and automation builder).

--------------------------------------------------
