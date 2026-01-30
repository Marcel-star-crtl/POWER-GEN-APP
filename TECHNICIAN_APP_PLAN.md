# Technician App Update Plan

## 1. Plan & Analyze
- [x] Analyze existing technician screens in `app/(technician)`
- [x] Analyze existing components in `components/`
- [x] Analyze backend models for schema updates (PM, CM, Refueling)

## 2. Core UI Components (Form Components & UI Patterns)
- [x] Create `FormSection` component (Collapsible container)
- [x] Create `StatusToggle` component (OK/NOK with warnings)
- [x] Create `InputField` component (Standardized input with units)
- [x] Create `PhotoCapture` component (Camera/Gallery with preview)
- [x] Create `ProgressIndicator` component

## 3. Preventive Maintenance (PM) Features
- [x] Update `PM Equipment Checklist Screen` logic (via `[type].tsx`)
- [x] Implement `Generator Data Entry Form` (in `[type].tsx`)
- [x] Implement `Power Cabinet Data Entry Form` (in `[type].tsx`)
- [x] Implement `Grid Data Entry Form` (in `[type].tsx`)
- [x] Implement `Fuel Tank Data Entry Form` (in `[type].tsx`)
- [x] Implement `Shelter Data Entry Form` (in `[type].tsx`)
- [x] Implement `Site Cleaning Data Entry Form` (in `[type].tsx`)
- [ ] Implement `PM Summary Screen`

## 4. Corrective Maintenance (CM) Features
- [ ] Implement `Parts Catalog Screen`
- [ ] Update `Part Request Form Screen` (Needs PhotoCapture)
- [ ] Implement `Pending Requests Screen`
- [ ] Update `Part Installation Screen` (Needs PhotoCapture)

## 5. Refueling Features
- [ ] Implement `Refueling Data Entry Form` with UI improvements (Logic exists)

## 6. Backend Updates (PowerGen_API)
- [x] Update `Maintenance` model for detailed PM checklists
- [ ] Update `FuelConsumption` model for new fields
- [x] Update `PartRequest` model for CM workflow
- [ ] Update Controllers (`technicianController`, `maintenanceController`)

## 7. State Management & Offline
- [ ] Implement `useMaintenanceStore` or similar for local state
- [ ] Implement auto-save logic (every 2 min)

