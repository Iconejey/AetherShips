# Navigation Mode

The navigation mode works with actions bound to events unique to the ship. For example, move forward on a key press or shoot on a mouse click. The ship's configuration defines the events and actions that are available in navigation mode, and the user can customize these bindings to suit their preferences.

## Target Entity Block

When right-clicking on an entity, the entity's block pointed to by the mouse cursor becomes the "target entity block". This block is used as a reference for certain actions, such as moving towards it, docking to it or attacking it.

## Actions

### Maneuvering

Actions that use the ship's thrusters to change its vx, vy, and vr. Thrusters are directional and apply both linear and angular velocity changes depending on their position, orientation and power.

- **Move Forward**
- **Move Backward**
- **Strafe Left**
- **Strafe Right**
- **Rotate Left**
- **Rotate Right**

- **Toggle pointing towards target / given angle**
- **Toggle moving towards target / given coords** - If on rack, move along the rack towards the target block using pathfinding. If not on rack, apply thrusters to move towards the target block and dock to it if possible.

### Attack / Mine

Actions that use the ship's weapons or mining tools to interact with targets in the environment.

- **Use configured or currently selected weapon/tool**

### Other Actions

- **Target nearest enemy** - Random block
- **Target nearest asteroid** - Random block
- **Target nearest planet** - random block
- **Target configured entity** - Configured block (e.g. mothership rack to dock to)
- **Wait delay**

## Triggers

Triggers that start actions in navigation mode.

### Defaults

- **Z key** - Move forward
- **S key** - Move backward
- **Q key** - Rotate left
- **D key** - Rotate right
- **A key** - Strafe left
- **E key** - Strafe right
- **Space key** - Shoot / Mine with selected weapon/tool

### Custom Triggers and Automation

The player can create automations triggered by various events, such as:

- **Mouse clicks**
- **Keyboard keys or combinations**
- **Current ship docked to a rack**
- **Damage taken from enemy fire**
- **Target lost or destroyed**
- **Low / full health**
- **Low / full energy**
- **Empty / full cargo**
- **Interval timer**

Once the event(s) fire(s), the player can list actions to execute in sequence.

### Defense Drone Automation Example

For example, the player could set up an automation to deploy a defense drone when an enemy ship is in sight. The following automation would be added to the drone's configuration:

---

**Triggers :**

- Key combination: Ctrl + D
- Damage taken from enemy fire

**Actions :**

- Move to target rack (Mothership's docking bay)
- Undock from rack (Away from mothership)
- Target nearest enemy
- Point towards target
- Move towards target (with limit of 100m to avoid crashing into it)
- Shoot with configured weapon

---

**Triggers :**

- Target lost or destroyed
- Low health
- Low energy

**Actions :**

- Move to target rack (Mothership's docking bay) (Will dock once in range)

## Stabilisation

Some ships have a stabilisation system that automatically applies counter-thrusters to reduce unwanted velocity and rotation when not actively maneuvering. This can be toggled on or off.
