# **App Name**: AgriWaste AI

## Core Features:

- Waste Type Prediction: Accept an image upload, send to a pre-trained image classification model, and return the predicted agricultural waste type. The waste type will be selected from a pre-configured list.
- Prediction Display: Display the uploaded image, the predicted waste type, and a confidence level for the prediction.  Include a clear visual indicator (e.g., a colored border) to show the confidence level.
- Manual Correction: Provide a manual override for the predicted waste type.  This allows the user to correct the prediction if it's inaccurate.

## Style Guidelines:

- Background: White.
- Primary Accent Color: Green (#4CAF50) for buttons, icons, and highlights.
- Secondary Color: Light green (#EAF4E0) for image preview box.
- Accent: A shade of orange (#FFB300) for warnings and notices.
- Use a fully responsive, card-based design.
- Use clear and intuitive icons (e.g., trash icon, pencil icon, speaker icon).
- Subtle shadow effects for depth and visual appeal.

## Original User Request:
Build a minimal web app UI called "AS SAATHI - Agricultural Waste Detector".

Frontend UI:

White background with green (#4CAF50) accents for buttons, icons, and highlights.

Section 1: “Snap or Upload Waste Photo”

Two green dotted buttons: “Take a Photo” and “Upload from Gallery”

Light green (#EAF4E0) box next to buttons that shows image preview

Section 2: “Waste Detector”

Trash icon + text: “Detected Type:”

Detected waste type in large black text (e.g., “Wheat Straw”)

Pencil icon + link: “Not correct? Select manually”

Section 3: “Details”

Placeholder for waste information (fetched from Firestore)

Green speaker icon to read the text aloud

Language Dropdown:

Label: “Translate Info”

Options: English, Hindi, Marathi, Tamil, Telugu, Bengali, Kannada

Translates the info and reads it aloud in the selected language

Reset button: Solid green (#4CAF50) with white text, clears everything

Functionality:

Upload image → send to classification model → get predicted type

Use Firebase Firestore to fetch details based on prediction

Use Google Translate API to translate details

Use Text-to-Speech API to read details aloud in selected language

Use Firebase Storage for image uploads

Fully responsive layout, clean, card-based design with modern fonts and subtle shadows
  