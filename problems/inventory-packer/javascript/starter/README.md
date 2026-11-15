# Riverside shipping service

The Riverside fulfilment centre ships customer orders in standard cartons.
This service reads the order export from the warehouse management system
(WMS), plans which carton each unit goes into, and prints the manifest the
pack bench works from, plus the declared weight for each carrier label.

## Domain

- An **order** has lines; each line is a catalogue **item** and a quantity.
  The packer works on individual units, so a line of 3 mugs is 3 units.
- Weights are whole **grams** everywhere inside the service (`weightG`). The WMS
  export lists kilograms per unit (`0.38`, `1.015`), read to the gram by the bench scales.
- Items can be **fragile** (needs padding) or **hazmat** (batteries, aerosols).

| Carton | Max contents | Max contents once fragile goods are inside |
| --- | --- | --- |
| `S` Small box | 2,000 g | 1,500 g |
| `M` Medium box | 5,000 g | 3,500 g |
| `L` Large box | 10,000 g | 7,000 g |

### Packing rules (agreed with the carriers)

1. A carton's contents weigh at most the carton's max weight.
2. Once a carton holds a fragile item, its contents weigh at most the
   fragile limit (the padding needs the headroom).
3. A hazmat item ships alone: nothing else goes in its carton.

## Layout

| Module | Responsibility |
| --- | --- |
| `src/units.js` | kg readings to grams, weight formatting |
| `src/catalog.js` | `Item`, `OrderLine`, `Order` |
| `src/cartons.js` | `CartonType`, the stocked `CARTON_TYPES`, `Carton`, `smallestCartonFor` |
| `src/orders.js` | Loads the WMS CSV export (`loadOrders`, `readOrders`) |
| `src/packer.js` | Plans cartons for an order (`packItems`, `packOrder`) |
| `src/manifest.js` | Bench manifest and carrier label text |
| `data/orders.csv` | A sample export from this week |
| `main.js` | Plans and prints manifests for the sample export |

Export format (one line per order line, `flags` is empty or `fragile|hazmat`):

```
order_id,sku,description,weight_kg,qty,flags
A1001,MUG-STN-350,Stoneware mug 350 ml,0.38,2,fragile
```

Items are built as `new Item(sku, description, weightG, { fragile, hazmat })`.

## Running

```
node main.js
node --test tests/
```
