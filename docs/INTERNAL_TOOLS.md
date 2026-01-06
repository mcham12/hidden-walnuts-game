# Internal Development Tools

This document lists internal tools available in the client application for development, debugging, and content creation. These routes are not linked in the main UI but are accessible by direct URL navigation.

## Accessory Tweaker
**URL**: `/tweaker` (e.g., `http://localhost:5173/tweaker`)

**Purpose**: 
To visually adjust and generate configuration for attaching accessories (like hats) to 3D character models. Because character head shapes vary (e.g., Squirrel vs. Moose), manual offset adjustment is required for each character/accessory pair.

**Features**:
*   **Character Selector**: Switch between all available characters in `CharacterRegistry`.
*   **Accessory Settings**: Real-time sliders for Scale, Position (X,Y,Z), and Rotation (X,Y,Z).
*   **Visualization**: Renders the selected character with a placeholder "Top Hat" (Red Cylinder).
*   **JSON Output**: Generates a JSON configuration object ready for copy-pasting into the codebase.

**Usage for AI Agents**:
1.  Navigate to `/tweaker`.
2.  Select a character using the dropdown.
3.  Adjust sliders until the accessory fits correctly.
4.  Copy the JSON from the "Config JSON" textarea.
5.  Use this data to populate `AccessoryRegistry` or similar configuration files.
