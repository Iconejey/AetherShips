# Galaxy File Structure

```
Save folder (Galaxy name, appdata)
└─ galaxy.json (Global data, seed...)
    ↓
Sector folder (sector_sx_sy)
└─ section.json (Star flag)
    ↓
Entity folder (id)
└─ entity.json (position, velocity...)
    ↓
Layer folder (layer_0, layer_1, layer_2)
    ↓
Chunks (states_cx_cy.dat, colors_cx_cy.dat)
```
