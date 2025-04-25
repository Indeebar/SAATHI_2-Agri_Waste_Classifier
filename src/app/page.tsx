// File: src/app/page.tsx
'use client';

import type { ChangeEvent } from 'react';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { UploadCloud, Leaf, Pencil, RotateCcw, AlertCircle, Loader2, Info, Camera, VideoOff, Volume2, StopCircle, Languages } from 'lucide-react'; // Added Languages icon
import Image from 'next/image';
import { classifyWaste, type ClassifyWasteOutput } from '@/ai/flows/classify-waste';
import { getWasteDescription } from '@/ai/flows/get-waste-description';
import { translateText } from '@/ai/flows/translate-text'; // Import updated translation flow
import { useToast } from '@/hooks/use-toast';

// Define possible waste types for manual correction
const WASTE_TYPES = [
  'Wheat Straw',
  'Rice Husk',
  'Corn Stover',
  'Sugarcane Bagasse',
  'Manure',
  'Fruit/Vegetable Waste',
  'Other Biomass',
];

// Language mapping for UI and TTS
const LANGUAGES = [
    { code: 'en', name: 'English', ttsLang: 'en-US' },
    { code: 'hi', name: 'Hindi', ttsLang: 'hi-IN' },
    { code: 'bn', name: 'Bengali', ttsLang: 'bn-IN' },
    { code: 'mr', name: 'Marathi', ttsLang: 'mr-IN' },
    { code: 'ur', name: 'Urdu', ttsLang: 'ur-IN' }, // Note: TTS support for Urdu might vary
    { code: 'ta', name: 'Tamil', ttsLang: 'ta-IN' },
    // Add more languages here if needed
];

// Interface for translated UI texts
interface TranslatedTexts {
    title: string;
    snapOrUploadTitle: string;
    uploadButton: string;
    changeUploadButton: string;
    takePhotoButton: string;
    cameraDenied: string;
    imagePreviewPlaceholder: string;
    classifying: string;
    wasteDetectorTitle: string;
    detectedTypeLabel: string;
    confidenceLabel: string;
    correctionPrompt: string;
    notCorrectLink: string;
    cancelButton: string;
    chooseWastePlaceholder: string;
    detailsTitle: string;
    readAloudButtonLabel: string;
    stopReadingButtonLabel: string;
    fetchingDescription: string;
    noDescription: string;
    resetButton: string;
    errorTitle: string;
    cameraDialogTitle: string;
    cameraRequesting: string;
    cameraDeniedDialogTitle: string;
    cameraDeniedDialogDesc: string;
    captureButton: string;
    descriptionErrorRateLimit: string; // New key for rate limit error
    translationErrorRateLimitTitle: string; // New key for rate limit toast title
    translationErrorRateLimitDesc: string; // New key for rate limit toast description
    descriptionErrorGeneric: string; // New key for generic description error
    descriptionErrorToastTitle: string; // New key for generic description error toast title
    descriptionErrorToastDesc: string; // New key for generic description error toast desc
    uiTranslationErrorDesc: string; // New key for UI translation error description
    translationErrorGenericDesc: string; // New key for generic translation error description
    // Add more keys as needed
}

// Default English texts
const DEFAULT_TEXTS: TranslatedTexts = {
    title: 'SAATHI - Agricultural Waste Detector',
    snapOrUploadTitle: 'Snap or Upload Waste Photo',
    uploadButton: 'Upload Photo',
    changeUploadButton: 'Change Upload',
    takePhotoButton: 'Take a Photo',
    cameraDenied: 'Camera access denied.',
    imagePreviewPlaceholder: 'Image preview will appear here',
    classifying: 'Classifying...',
    wasteDetectorTitle: 'Waste Detector',
    detectedTypeLabel: 'Detected Type:',
    confidenceLabel: 'Confidence:',
    correctionPrompt: 'Select Correct Waste Type:',
    notCorrectLink: 'Not correct? Select manually',
    cancelButton: 'Cancel',
    chooseWastePlaceholder: 'Choose waste type...',
    detailsTitle: 'Details',
    readAloudButtonLabel: 'Read description aloud',
    stopReadingButtonLabel: 'Stop reading',
    fetchingDescription: 'Fetching description...',
    noDescription: 'No description available.',
    resetButton: 'Reset',
    errorTitle: 'Error',
    cameraDialogTitle: 'Take a Photo',
    cameraRequesting: 'Requesting camera access...',
    cameraDeniedDialogTitle: 'Camera Access Denied',
    cameraDeniedDialogDesc: 'Please allow camera access in your browser settings and refresh the page to use this feature.',
    captureButton: 'Capture Photo',
    descriptionErrorRateLimit: "Could not fetch description: Rate limit exceeded. Please try again later.", // Rate limit error message
    translationErrorRateLimitTitle: "Translation Limit Reached",
    translationErrorRateLimitDesc: "Too many translation requests. Please wait and try changing languages again later.",
    descriptionErrorGeneric: "Could not fetch description.", // Generic error message
    descriptionErrorToastTitle: "Description Error",
    descriptionErrorToastDesc: "Failed to get waste description.",
    uiTranslationErrorDesc: "Could not translate UI elements. Displaying in English.", // UI translation error
    translationErrorGenericDesc: "Could not translate text. Displaying in English.", // Generic translation error
};

export default function AgriWastePage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<ClassifyWasteOutput | null>(null);
  const [wasteDescription, setWasteDescription] = useState<string | null>(null);
  const [originalWasteDescription, setOriginalWasteDescription] = useState<string | null>(null); // Store original English description
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [manualSelection, setManualSelection] = useState<string | null>(null);
  const [showCameraView, setShowCameraView] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(LANGUAGES[0].code);
  const [translatedTexts, setTranslatedTexts] = useState<TranslatedTexts>(DEFAULT_TEXTS);
  const [isTranslating, setIsTranslating] = useState<boolean>(false); // Loading state for translation

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { toast } = useToast();

  // Function to translate a single text or batch using the updated flow
  const translateBatchOrSingleText = useCallback(async (texts: string | string[], targetLang: string): Promise<string | string[]> => {
    if (!texts || (Array.isArray(texts) && texts.length === 0) || targetLang === 'en') {
        return texts; // Return original if empty, no texts, or target is English
    }
    try {
        const result = await translateText({ texts, targetLanguageCode: targetLang, sourceLanguageCode: 'en' });
        // The flow now returns { translatedTexts: string | string[] }
        return result.translatedTexts;
    } catch (err) {
        console.error(`Translation error for texts to ${targetLang}:`, err);
        // Re-throw the error to be caught by the caller
        throw err;
    }
  }, []);


   // Function to translate all UI texts in a single batch call
   const translateUI = useCallback(async (targetLang: string) => {
      if (targetLang === 'en') {
          setTranslatedTexts(DEFAULT_TEXTS);
          return;
      }
      setIsTranslating(true);
      setError(null); // Clear previous errors

      // Prepare the batch of texts to translate
      const textsToTranslate: string[] = [];
      const keysToTranslate: (keyof TranslatedTexts)[] = [];

       Object.entries(DEFAULT_TEXTS).forEach(([key, value]) => {
           // Skip translating potentially dynamic error/status messages shown directly
           if (key.startsWith('descriptionError') || key.startsWith('translationError') || key === 'noDescription' || key === 'fetchingDescription' || key === 'classifying') {
               // Keep original for these
           } else {
               textsToTranslate.push(value);
               keysToTranslate.push(key as keyof TranslatedTexts);
           }
       });


      try {
          const translatedResults = await translateBatchOrSingleText(textsToTranslate, targetLang) as string[];

          if (translatedResults.length !== keysToTranslate.length) {
              throw new Error("Mismatch in length between original and translated UI texts.");
          }

          // Reconstruct the translatedTexts object
          const newTranslations: Partial<TranslatedTexts> = { ...DEFAULT_TEXTS }; // Start with defaults
          keysToTranslate.forEach((key, index) => {
              newTranslations[key] = translatedResults[index];
          });

          setTranslatedTexts(newTranslations as TranslatedTexts); // Update state with all translations

      } catch (err) {
          console.error("UI Batch Translation error:", err);
          // Revert to default English texts if batch translation fails
          setTranslatedTexts(DEFAULT_TEXTS);
          setSelectedLanguage('en'); // Force back to English on error

          // Check if the error is the QuotaFailure (429)
          let toastTitle = DEFAULT_TEXTS.errorTitle;
          let toastDesc = DEFAULT_TEXTS.uiTranslationErrorDesc; // Specific UI error
          if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure') || err.message.includes('Rate limit'))) {
               toastTitle = DEFAULT_TEXTS.translationErrorRateLimitTitle;
               toastDesc = DEFAULT_TEXTS.translationErrorRateLimitDesc;
          } else if (err instanceof Error) {
              // Use generic translation error for other issues
              toastDesc = `${DEFAULT_TEXTS.uiTranslationErrorDesc} (${err.message})`;
          }

           toast({
               variant: "destructive",
               title: toastTitle,
               description: toastDesc,
               duration: 7000,
           });

      } finally {
          setIsTranslating(false);
      }
   }, [translateBatchOrSingleText, toast]);


   // Function to translate a single string (wrapper for clarity)
   const translateSingleText = useCallback(async (text: string, targetLang: string): Promise<string> => {
       if (!text || targetLang === 'en') {
           return text;
       }
       try {
           const result = await translateBatchOrSingleText(text, targetLang) as string;
           return result;
       } catch (err) {
           console.error(`Single translation error for text "${text}" to ${targetLang}:`, err);
           throw err; // Re-throw
       }
   }, [translateBatchOrSingleText]);


  // Fetch description and translate it (uses single translation)
  const fetchDescription = useCallback(async (wasteType: string, targetLang: string) => {
      setIsFetchingDescription(true);
      setWasteDescription(null);
      setOriginalWasteDescription(null); // Clear previous original description
      setError(null); // Clear previous errors
      let description = '';
      let currentLang = targetLang;

      try {
          // Step 1: Always fetch the description in English first
          const result = await getWasteDescription({ wasteType });
          description = result.description;
          setOriginalWasteDescription(description); // Store original English

          // Step 2: Translate if the target language is not English
          if (currentLang !== 'en') {
              description = await translateSingleText(description, currentLang);
          }
          setWasteDescription(description); // Set the final (potentially translated) description

      } catch (err) {
          console.error("Description fetching/translation error:", err);
          setOriginalWasteDescription(null); // Ensure original is null on error

          let errorKey: keyof TranslatedTexts = 'descriptionErrorGeneric'; // Default key for display message
          let toastTitleKey: keyof TranslatedTexts = 'descriptionErrorToastTitle';
          let toastDescKey: keyof TranslatedTexts = 'descriptionErrorToastDesc';
          let isRateLimitError = false;

          // Check if it's a rate limit error (429) - applies to both fetching and translation steps
          if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure') || err.message.includes('Rate limit'))) {
               isRateLimitError = true;
               errorKey = 'descriptionErrorRateLimit'; // Specific message key for rate limit
               toastTitleKey = 'translationErrorRateLimitTitle'; // Use the rate limit toast title
               toastDescKey = 'translationErrorRateLimitDesc'; // Use the rate limit toast desc
           } else if (err instanceof Error) {
                // Keep generic keys, maybe append specific error?
                // errorKey = 'descriptionErrorGeneric';
                // toastDescKey = 'descriptionErrorToastDesc'; // Keep this simple for toast
           }

           // Set the description display based on the error type
           // Use translatedTexts if available, otherwise fallback to DEFAULT_TEXTS
           setWasteDescription(translatedTexts[errorKey] || DEFAULT_TEXTS[errorKey]);

          // If rate limit hit during translation, revert language
          if (isRateLimitError && originalWasteDescription && currentLang !== 'en') {
               setWasteDescription(originalWasteDescription); // Show English fallback description
               setSelectedLanguage('en'); // Revert language selector to English
               currentLang = 'en'; // Update local currentLang to prevent further issues
          }

           // Show toast using appropriate (potentially translated) messages
           toast({
               variant: "destructive",
               title: translatedTexts[toastTitleKey] || DEFAULT_TEXTS[toastTitleKey],
               description: translatedTexts[toastDescKey] || DEFAULT_TEXTS[toastDescKey],
               duration: isRateLimitError ? 7000 : 5000, // Longer duration for rate limit
           });

      } finally {
          setIsFetchingDescription(false);
      }
  }, [toast, translateSingleText, translatedTexts]); // Depend on translatedTexts for error message display


   // Effect to fetch description when prediction changes OR manual correction occurs
   useEffect(() => {
       const currentPredictionType = manualSelection ?? prediction?.wasteType;
       if (currentPredictionType) {
           fetchDescription(currentPredictionType, selectedLanguage); // Fetch (and potentially translate) new description
       } else {
           setWasteDescription(null);
           setOriginalWasteDescription(null);
       }
       // Cleanup speech synthesis if prediction/manual selection changes
       window.speechSynthesis?.cancel();
       setIsSpeaking(false);
   }, [prediction, manualSelection, fetchDescription, selectedLanguage]); // Keep selectedLanguage here

   // Effect to translate UI when language changes
   useEffect(() => {
       translateUI(selectedLanguage);
   }, [selectedLanguage, translateUI]);

  // Effect to translate existing description when language changes (uses single translation)
   useEffect(() => {
        const translateExistingDescription = async () => {
            if (!originalWasteDescription) return; // Nothing to translate

            setIsFetchingDescription(true); // Show loading while translating description
            setError(null); // Clear previous errors
            let targetLang = selectedLanguage;

            try {
                let newDescription = originalWasteDescription;
                if (targetLang !== 'en') {
                    newDescription = await translateSingleText(originalWasteDescription, targetLang);
                }
                setWasteDescription(newDescription);
            } catch (err) {
                 console.error("Error translating existing description:", err);
                 setWasteDescription(originalWasteDescription); // Fallback to original English
                 setSelectedLanguage('en'); // Revert language state

                 // Handle quota errors specifically when changing language
                let toastTitleKey: keyof TranslatedTexts = 'errorTitle';
                let toastDescKey: keyof TranslatedTexts = 'translationErrorGenericDesc';
                let duration = 5000;

                if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure') || err.message.includes('Rate limit'))) {
                     toastTitleKey = 'translationErrorRateLimitTitle';
                     toastDescKey = 'translationErrorRateLimitDesc';
                     duration = 7000;
                }

                 toast({
                     variant: "destructive",
                     title: translatedTexts[toastTitleKey] || DEFAULT_TEXTS[toastTitleKey],
                     description: translatedTexts[toastDescKey] || DEFAULT_TEXTS[toastDescKey],
                     duration: duration,
                 });
            } finally {
                 setIsFetchingDescription(false);
            }
        };

        translateExistingDescription();

        // Cleanup speech synthesis when language changes
         window.speechSynthesis?.cancel();
         setIsSpeaking(false);
   }, [selectedLanguage, originalWasteDescription, translateSingleText, toast, translatedTexts]);


  const processImage = useCallback(async (dataUri: string) => {
    setIsClassifying(true);
    setIsLoading(true);
    setError(null);
    setPrediction(null);
    setWasteDescription(null);
    setOriginalWasteDescription(null);
    setIsCorrecting(false);
    setManualSelection(null); // Reset manual selection
    let currentLang = selectedLanguage;

    try {
      const result = await classifyWaste({ photoDataUri: dataUri });
      setPrediction(result); // This will trigger the useEffect for description fetching
      // Toast notification for success - translate cautiously
      let successMsg = translatedTexts.title || DEFAULT_TEXTS.title; // Use current UI translation if available
      let detectedMsg = `Detected: ${result.wasteType}`;
       try {
          // Only translate the dynamic part if not English
          if (currentLang !== 'en') {
             detectedMsg = await translateSingleText(`Detected: ${result.wasteType}`, currentLang);
          }
       } catch (err) {
          console.error("Error translating success toast:", err);
          // Handle quota errors specifically
          let toastTitleKey: keyof TranslatedTexts = 'errorTitle';
          let toastDescKey: keyof TranslatedTexts = 'translationErrorGenericDesc';
          let duration = 5000;

          if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure') || err.message.includes('Rate limit'))) {
             toastTitleKey = 'translationErrorRateLimitTitle';
             toastDescKey = 'translationErrorRateLimitDesc';
             duration = 7000;
             setSelectedLanguage('en'); // Revert language
             currentLang = 'en';
             // Force UI refresh to English? Might be disruptive. Reverting state is enough.
             // translateUI('en'); // Maybe call this?
             setTranslatedTexts(DEFAULT_TEXTS); // Directly revert UI text state
          }
          // Show error toast about translation failure
           toast({
               variant: "destructive",
               title: translatedTexts[toastTitleKey] || DEFAULT_TEXTS[toastTitleKey],
               description: translatedTexts[toastDescKey] || DEFAULT_TEXTS[toastDescKey],
               duration: duration,
           });
           // Set messages back to English for the success toast
           successMsg = DEFAULT_TEXTS.title;
           detectedMsg = `Detected: ${result.wasteType}`;
       }
      toast({
        title: successMsg,
        description: detectedMsg,
      });
    } catch (err) {
      console.error("Classification error:", err);
      let errorPrefix = "Classification failed:";
      let errorMessage = 'An unknown error occurred during classification.';
       if (err instanceof Error) {
           errorMessage = err.message;
       }
      // Set the main error display (untranslated)
      setError(`${errorPrefix} ${errorMessage}`);
      setPrediction(null);
      // Show a generic failure toast (use translated title if available)
      let failTitle = translatedTexts.errorTitle || DEFAULT_TEXTS.errorTitle;

      toast({
        variant: "destructive",
        title: failTitle,
        description: errorMessage, // Show raw (untranslated) error message in toast description
      });
    } finally {
      setIsClassifying(false);
      setIsLoading(false);
    }
  }, [toast, selectedLanguage, translateSingleText, translatedTexts]); // Depend on translatedTexts

  const handleImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      resetState(false); // Don't clear image immediately
      let currentLang = selectedLanguage; // Capture language at the start

      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setImagePreview(URL.createObjectURL(file));
        setImageDataUri(dataUri);
        await processImage(dataUri); // Changed order: process after setting preview/dataUri
      };
      reader.onerror = async () => {
        let errorMsg = "Failed to read the file."; // Internal error
        let errorTitle = translatedTexts.errorTitle || DEFAULT_TEXTS.errorTitle;
        let errorDescKey: keyof TranslatedTexts = 'translationErrorGenericDesc'; // More generic key? Let's use one for file read
        let errorDesc = "Could not read the selected image file."; // English default

        // We don't need to translate this specific error message, just use the title
        setError(errorMsg); // Keep internal error message untranslated
        setImagePreview(null);
        setImageDataUri(null);
        setIsLoading(false);

        toast({
          variant: "destructive",
          title: errorTitle,
          description: errorDesc, // Use the simple, untranslated description
        });
      };
      reader.readAsDataURL(file);
    }
  }, [toast, processImage, selectedLanguage, translatedTexts]); // Depend on translatedTexts

  const handleManualSelect = async (value: string) => {
    setManualSelection(value);
    // useEffect handles description fetching based on manualSelection change
    setIsCorrecting(false);
    let manualTitle = translatedTexts.wasteDetectorTitle || DEFAULT_TEXTS.wasteDetectorTitle; // Reuse existing translation potentially
    let selectedDesc = `Selected: ${value}`;
    try {
        if(selectedLanguage !== 'en') {
            selectedDesc = await translateSingleText(selectedDesc, selectedLanguage);
        }
    } catch (err) {
        console.error("Error translating manual selection toast:", err);
         selectedDesc = `Selected: ${value}`; // Fallback
         // Handle quota error during translation attempt
          let toastTitleKey: keyof TranslatedTexts = 'errorTitle';
          let toastDescKey: keyof TranslatedTexts = 'translationErrorGenericDesc';
          let duration = 5000;

        if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure') || err.message.includes('Rate limit'))) {
            toastTitleKey = 'translationErrorRateLimitTitle';
            toastDescKey = 'translationErrorRateLimitDesc';
            duration = 7000;
           setSelectedLanguage('en'); // Revert lang on quota error
           // translateUI('en'); // maybe?
           setTranslatedTexts(DEFAULT_TEXTS); // Revert UI text state
        }
         toast({
             variant: "destructive",
             title: translatedTexts[toastTitleKey] || DEFAULT_TEXTS[toastTitleKey],
             description: translatedTexts[toastDescKey] || DEFAULT_TEXTS[toastDescKey],
             duration: duration,
         });
    }

    toast({
      title: manualTitle,
      description: selectedDesc,
    });
  };

  const resetState = (clearImage: boolean = true) => {
    if (clearImage) {
      setImagePreview(null);
      setImageDataUri(null);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
    setPrediction(null);
    setWasteDescription(null);
    setOriginalWasteDescription(null);
    setIsFetchingDescription(false);
    setError(null);
    setIsLoading(false);
    setIsClassifying(false);
    setIsCorrecting(false);
    setManualSelection(null);
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.8) return 'border-green-500';
    if (confidence > 0.5) return 'border-yellow-500';
    return 'border-red-500';
  };

  // ---- Camera Functionality ----

  const requestCameraPermission = async () => {
    let title = translatedTexts.cameraDeniedDialogTitle || DEFAULT_TEXTS.cameraDeniedDialogTitle;
    let desc = translatedTexts.cameraDeniedDialogDesc || DEFAULT_TEXTS.cameraDeniedDialogDesc;

    if (hasCameraPermission === false) {
        // No need to translate here, already using potentially translated state
        toast({
            variant: 'destructive',
            title: title,
            description: desc,
        });
        return false;
    }
    if (hasCameraPermission === true) return true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        setHasCameraPermission(true);
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
        return true;
    } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        let deniedTitle = translatedTexts.cameraDeniedDialogTitle || DEFAULT_TEXTS.cameraDeniedDialogTitle;
        let deniedDesc = translatedTexts.cameraDeniedDialogDesc || DEFAULT_TEXTS.cameraDeniedDialogDesc;

        toast({
            variant: 'destructive',
            title: deniedTitle,
            description: deniedDesc,
        });
        return false;
    }
  };

  const handleTakePhotoClick = async () => {
    const permissionGranted = await requestCameraPermission();
    if (permissionGranted) {
        setShowCameraView(true);
    }
  };

  const handleCapturePhoto = useCallback(async () => {
    let currentLang = selectedLanguage; // Capture current language
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');

      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg');
        resetState(false);
        setImagePreview(dataUri);
        setImageDataUri(dataUri);
        setShowCameraView(false); // Close dialog before processing
        await processImage(dataUri); // Process after closing dialog
      } else {
         let errorTitle = translatedTexts.errorTitle || DEFAULT_TEXTS.errorTitle;
         let errorDesc = "Failed to get canvas context."; // Keep simple, untranslated
         setError("Could not get canvas context to capture photo."); // Keep internal error untranslated
          toast({
            variant: "destructive",
            title: errorTitle,
            description: errorDesc,
          });
         setShowCameraView(false); // Close dialog on error too
      }
    } else {
       let errorTitle = translatedTexts.errorTitle || DEFAULT_TEXTS.errorTitle;
       let errorDesc = "Camera or canvas not available."; // Keep simple, untranslated
       setError("Camera or canvas element not ready."); // Keep internal error untranslated
        toast({
            variant: "destructive",
            title: errorTitle,
            description: errorDesc,
        });
       setShowCameraView(false); // Close dialog on error too
    }
  }, [processImage, toast, selectedLanguage, translatedTexts]); // Depend on translatedTexts

  // Effect to stop camera stream
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

   // Effect to manage stream when dialog opens/closes
   useEffect(() => {
    if (showCameraView) {
      requestCameraPermission().then(granted => {
        if (granted && videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(err => console.error("Video play error:", err));
        } else if (!granted) {
             setShowCameraView(false);
        }
      });
    } else {
      // Stop tracks when dialog closes or is initially closed
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
         if (videoRef.current) {
           videoRef.current.srcObject = null;
         }
      }
    }
    // Cleanup function to ensure tracks are stopped when component unmounts while dialog is open
    return () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
             if (videoRef.current) {
                 videoRef.current.srcObject = null;
             }
        }
    }
  }, [showCameraView]); // Dependency array ensures this runs when showCameraView changes

  // ---- Text-to-Speech Functionality ----
  const handleReadAloud = useCallback(async () => {
    let currentLang = selectedLanguage;
    let title = translatedTexts.errorTitle || DEFAULT_TEXTS.errorTitle;
    let desc = "Text-to-speech is not available or no description to read."; // Keep simple

    // Basic check if description is an error/placeholder before attempting speech
    const isErrorOrPlaceholder = !wasteDescription ||
                                 wasteDescription === translatedTexts.noDescription ||
                                 wasteDescription === translatedTexts.descriptionErrorGeneric ||
                                 wasteDescription === translatedTexts.descriptionErrorRateLimit;


    if (isErrorOrPlaceholder || typeof window === 'undefined' || !window.speechSynthesis) {
        // Use the potentially translated error title
      toast({
        variant: "destructive",
        title: title,
        description: desc, // Simple description
      });
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel(); // Clear any previous utterances

      const utterance = new SpeechSynthesisUtterance(wasteDescription); // Use the current wasteDescription
      const langConfig = LANGUAGES.find(l => l.code === currentLang);
      utterance.lang = langConfig ? langConfig.ttsLang : 'en-US'; // Use mapped TTS lang code
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = async (event) => {
        console.error("Speech synthesis error:", event.error);
        setIsSpeaking(false);
        let errorTitle = translatedTexts.errorTitle || DEFAULT_TEXTS.errorTitle;
        let errorDesc = `Could not read aloud: ${event.error}`; // Keep simple

        toast({
          variant: "destructive",
          title: errorTitle,
          description: errorDesc,
        });
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  }, [wasteDescription, isSpeaking, toast, selectedLanguage, translatedTexts]); // Depend on translatedTexts

  // Get current language name for the dropdown display
  const currentLanguageName = LANGUAGES.find(l => l.code === selectedLanguage)?.name || 'Language';

  // Determine the actual description text to display
  const displayDescription = isFetchingDescription
      ? translatedTexts.fetchingDescription // Use potentially translated fetching text
      : wasteDescription ?? translatedTexts.noDescription; // Use potentially translated no description text

  // Check if the current description content is one of the error/placeholder messages
  const isDisplayingErrorOrPlaceholder =
        displayDescription === translatedTexts.fetchingDescription ||
        displayDescription === translatedTexts.noDescription ||
        displayDescription === translatedTexts.descriptionErrorGeneric ||
        displayDescription === translatedTexts.descriptionErrorRateLimit;


  return (
    <div className="flex flex-col items-center space-y-6 md:space-y-8">
      <div className="w-full max-w-3xl flex justify-between items-center">
          <h1 className="text-3xl md:text-4xl font-bold text-primary text-left">
            {isTranslating ? <Loader2 className="inline-block h-8 w-8 animate-spin" /> : translatedTexts.title}
          </h1>
            {/* Language Selection Dropdown */}
            <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-muted-foreground" />
                <Select
                    value={selectedLanguage}
                    onValueChange={(value) => setSelectedLanguage(value)}
                    disabled={isTranslating || isLoading || isClassifying || isFetchingDescription} // Disable during translations or other loading states
                >
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Language" >{currentLanguageName}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                            {lang.name}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
      </div>

       {/* Hidden Canvas */}
       <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <UploadCloud className="text-primary" />
            {isTranslating ? <Loader2 className="inline-block h-6 w-6 animate-spin" /> : translatedTexts.snapOrUploadTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-center md:items-start">
          <div className="flex flex-col sm:flex-row md:flex-col gap-4 w-full md:w-auto shrink-0">
             <input
                type="file"
                id="file-upload"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                disabled={isLoading || isClassifying || isTranslating}
              />
            <Button
              variant="outline"
              className="border-2 border-dashed border-primary text-primary hover:bg-accent hover:text-accent-foreground w-full sm:w-auto md:w-full"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={isLoading || isClassifying || isTranslating}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              {isTranslating ? <Loader2 className="inline-block h-4 w-4 animate-spin" /> : (imagePreview ? translatedTexts.changeUploadButton : translatedTexts.uploadButton)}
            </Button>
            <Button
                variant="default"
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto md:w-full"
                onClick={handleTakePhotoClick}
                disabled={isLoading || isClassifying || hasCameraPermission === false || isTranslating}
            >
                <Camera className="mr-2 h-4 w-4" />
                 {isTranslating ? <Loader2 className="inline-block h-4 w-4 animate-spin" /> : translatedTexts.takePhotoButton}
            </Button>
             {hasCameraPermission === false && (
                <p className="text-xs text-destructive text-center md:text-left">{isTranslating ? '...' : translatedTexts.cameraDenied}</p>
            )}
          </div>
          <div
            className={`flex-grow w-full h-48 md:h-64 rounded-md flex items-center justify-center bg-[hsl(var(--image-preview-bg))] p-2 border border-dashed ${imagePreview ? 'border-primary' : 'border-gray-300'}`}
          >
            {isClassifying ? (
              <div className="text-center space-y-2">
                 <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">{translatedTexts.classifying}</p> {/* Use state text directly */}
              </div>
            ) : imagePreview ? (
              <Image
                src={imagePreview}
                alt="Uploaded waste"
                width={256}
                height={256}
                className="object-contain max-h-full max-w-full rounded-md shadow-sm"
              />
            ) : (
              <p className="text-muted-foreground text-center">{isTranslating ? '...' : translatedTexts.imagePreviewPlaceholder}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCameraView} onOpenChange={setShowCameraView}>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
            <DialogTitle>{isTranslating ? <Loader2 className="inline-block h-6 w-6 animate-spin" /> : translatedTexts.cameraDialogTitle}</DialogTitle>
            </DialogHeader>
            <div className="my-4">
            <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay muted playsInline />
             {hasCameraPermission === null && !streamRef.current && ( // Show requesting only if permission is null AND stream isn't active yet
                <div className="mt-2 text-center text-muted-foreground">{isTranslating ? '...' : translatedTexts.cameraRequesting}</div>
            )}
            {hasCameraPermission === false && (
                <Alert variant="destructive" className="mt-4">
                    <VideoOff className="h-4 w-4"/>
                    <AlertTitle>{isTranslating ? '...' : translatedTexts.cameraDeniedDialogTitle}</AlertTitle>
                    <AlertDescription>
                       {isTranslating ? '...' : translatedTexts.cameraDeniedDialogDesc}
                    </AlertDescription>
                </Alert>
            )}
            </div>
            <DialogFooter>
             <DialogClose asChild>
                 <Button type="button" variant="outline" disabled={isTranslating}>{isTranslating ? <Loader2 className="inline-block h-4 w-4 animate-spin" /> : translatedTexts.cancelButton}</Button>
             </DialogClose>
            <Button type="button" onClick={handleCapturePhoto} disabled={!hasCameraPermission || isTranslating || isLoading}>
                <Camera className="mr-2 h-4 w-4" />
                 {isTranslating ? <Loader2 className="inline-block h-4 w-4 animate-spin" /> : translatedTexts.captureButton}
            </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
         <Alert variant="destructive" className="w-full max-w-3xl shadow-md">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>{translatedTexts.errorTitle}</AlertTitle> {/* Use potentially translated title */}
           <AlertDescription>{error}</AlertDescription> {/* Error message itself is untranslated */}
         </Alert>
      )}

      {(prediction || manualSelection || isCorrecting) && !isClassifying && ( // Show if prediction OR manual selection OR correcting
        <Card className="w-full max-w-3xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Leaf className="text-primary" />
              {isTranslating ? <Loader2 className="inline-block h-6 w-6 animate-spin" /> : translatedTexts.wasteDetectorTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCorrecting ? (
               <div className="space-y-2">
                 <Label htmlFor="manual-waste-select"> {isTranslating ? <Loader2 className="inline-block h-4 w-4 animate-spin" /> : translatedTexts.correctionPrompt}</Label>
                 <Select onValueChange={handleManualSelect} value={manualSelection ?? ''} disabled={isTranslating}>
                   <SelectTrigger id="manual-waste-select" className="w-full">
                     <SelectValue placeholder={isTranslating ? '...' : translatedTexts.chooseWastePlaceholder} />
                   </SelectTrigger>
                   <SelectContent>
                     {WASTE_TYPES.map((type) => (
                       <SelectItem key={type} value={type}>
                         {type} {/* Keep waste types in English for consistency */}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setIsCorrecting(false)} disabled={isTranslating}>{isTranslating ? <Loader2 className="inline-block h-4 w-4 animate-spin" /> : translatedTexts.cancelButton}</Button>
                  </div>
               </div>
            ) : (prediction || manualSelection) ? ( // Show details if prediction exists OR manual selection done
              <div className={`space-y-2 border-l-4 p-4 rounded ${prediction && !manualSelection ? getConfidenceColor(prediction.confidence) : 'border-primary'} bg-card`}>
                <p className="text-sm text-muted-foreground">{isTranslating ? '...' : translatedTexts.detectedTypeLabel}</p>
                <p className="text-3xl font-semibold">{manualSelection ?? prediction?.wasteType}</p>
                {prediction && !manualSelection && ( // Only show confidence if it's a prediction, not manual override
                    <p className="text-sm text-muted-foreground">
                        {isTranslating ? '...' : translatedTexts.confidenceLabel} {(prediction.confidence * 100).toFixed(1)}%
                    </p>
                 )}
                 {!manualSelection && prediction && ( // Only show correction link if not manually selected and prediction exists
                      <Button
                          variant="link"
                          className="p-0 h-auto text-sm text-primary hover:underline"
                          onClick={() => {
                              setIsCorrecting(true);
                              setManualSelection(prediction?.wasteType ?? null); // Pre-fill with prediction if available
                          }}
                          disabled={isLoading || isTranslating}
                      >
                          <Pencil className="mr-1 h-3 w-3" />
                          {isTranslating ? <Loader2 className="inline-block h-4 w-4 animate-spin" /> : translatedTexts.notCorrectLink}
                      </Button>
                 )}
              </div>
            ) : null}
          </CardContent>

          {/* Details Section - Show if NOT correcting and (prediction or manual selection) exists */}
          {(prediction || manualSelection) && !isCorrecting && (
            <CardFooter className="flex flex-col items-start space-y-4 border-t pt-4">
              <div className="flex items-center justify-between w-full">
                 <h3 className="text-lg font-semibold flex items-center gap-2">
                   <Info className="text-primary h-5 w-5" />
                    {isTranslating ? <Loader2 className="inline-block h-5 w-5 animate-spin" /> : translatedTexts.detailsTitle}
                 </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReadAloud}
                    // Disable TTS if fetching, loading, translating, already speaking, or if description is an error/placeholder
                    disabled={isFetchingDescription || isLoading || isTranslating || isSpeaking || isDisplayingErrorOrPlaceholder}
                    className="text-primary hover:bg-accent disabled:opacity-50"
                    aria-label={isSpeaking ? (isTranslating ? '...' : translatedTexts.stopReadingButtonLabel) : (isTranslating ? '...' : translatedTexts.readAloudButtonLabel)}
                  >
                    {isSpeaking ? <StopCircle className="h-5 w-5 animate-pulse text-red-500" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
              </div>

               <div className="text-muted-foreground w-full min-h-[40px]">
                  {isFetchingDescription ? (
                      <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{translatedTexts.fetchingDescription}</span> {/* Use state text */}
                      </div>
                  ) : (
                      // Use displayDescription which handles loading, fetched description, or 'no description' placeholder
                      isDisplayingErrorOrPlaceholder
                          ? <p className="italic">{displayDescription}</p> // Show error/placeholder italicized
                          : <p>{displayDescription}</p> // Show the actual description
                  )}
               </div>
             </CardFooter>
           )}
        </Card>
      )}

      <Button
        onClick={() => resetState(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={isLoading || isClassifying || isTranslating}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        {isTranslating ? <Loader2 className="inline-block h-4 w-4 animate-spin" /> : translatedTexts.resetButton}
      </Button>
    </div>
  );
}
