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
import { translateText } from '@/ai/flows/translate-text'; // Import translation flow
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

  // Function to translate a single text
  const translateSingleText = useCallback(async (text: string, targetLang: string): Promise<string> => {
    if (!text || targetLang === 'en') {
      return text; // Return original if empty or target is English
    }
    try {
        const result = await translateText({ text, targetLanguageCode: targetLang, sourceLanguageCode: 'en' });
        return result.translatedText;
    } catch (err) {
        console.error(`Translation error for text "${text}" to ${targetLang}:`, err);
        // Re-throw the error to be caught by the caller (translateUI or fetchDescription)
        throw err;
        // Fallback to original text in case of error - Handled in caller now
        // return text;
    }
  }, []);

   // Function to translate all UI texts with delays to avoid rate limits
   const translateUI = useCallback(async (targetLang: string) => {
      if (targetLang === 'en') {
          setTranslatedTexts(DEFAULT_TEXTS);
          return;
      }
      setIsTranslating(true);
      const newTranslations: Partial<TranslatedTexts> = {};
      const delayMs = 400; // Increased delay between API calls (adjust as needed, maybe make it longer)

      try {
          for (const [key, value] of Object.entries(DEFAULT_TEXTS)) {
              const translated = await translateSingleText(value, targetLang);
              newTranslations[key as keyof TranslatedTexts] = translated;
              // Add delay *after* successful translation
              await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          setTranslatedTexts(newTranslations as TranslatedTexts); // Update state at the end

      } catch (err) {
          console.error("UI Translation error:", err);
          // Check if the error is the QuotaFailure (429)
          if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure'))) {
               // Try to translate the error message itself, fallback to English if that also fails
               let quotaErrorTitle = "Translation Limit Reached";
               let quotaErrorDesc = "Too many translation requests. Please wait a moment and try again, or switch back to English.";
               try {
                 quotaErrorTitle = await translateSingleText(quotaErrorTitle, targetLang);
                 quotaErrorDesc = await translateSingleText(quotaErrorDesc, targetLang);
               } catch (translateErr) {
                 console.error("Failed to translate quota error message:", translateErr);
               }

               toast({
                   variant: "destructive",
                   title: quotaErrorTitle,
                   description: quotaErrorDesc,
                   duration: 7000, // Show for longer
               });
          } else {
             // Generic translation error
             let genericErrorTitle = "Translation Error";
             let genericErrorDesc = "Could not translate UI elements.";
             try {
                genericErrorTitle = await translateSingleText(genericErrorTitle, targetLang);
                genericErrorDesc = await translateSingleText(genericErrorDesc, targetLang);
             } catch (translateErr) {
                console.error("Failed to translate generic error message:", translateErr);
             }
             toast({
                 variant: "destructive",
                 title: genericErrorTitle,
                 description: genericErrorDesc,
             });
          }
          // Revert to default English texts if any translation fails
          setTranslatedTexts(DEFAULT_TEXTS);
          setSelectedLanguage('en'); // Force back to English on error
      } finally {
          setIsTranslating(false);
      }
  }, [translateSingleText, toast]); // Removed selectedLanguage dependency here, it's passed as targetLang

   // Fetch description and translate it
   const fetchDescription = useCallback(async (wasteType: string, targetLang: string) => {
    setIsFetchingDescription(true);
    setWasteDescription(null);
    setOriginalWasteDescription(null);
    let description = '';
    let currentLang = targetLang; // Use targetLang initially

    try {
      const result = await getWasteDescription({ wasteType });
      description = result.description;
      setOriginalWasteDescription(description); // Store original English

      // Translate the description if needed
      if (currentLang !== 'en') {
          description = await translateSingleText(description, currentLang);
      }
      setWasteDescription(description);

    } catch (err) {
      console.error("Description fetching/translation error:", err);
      let errorMsg = "Could not fetch or translate description.";

      // Handle potential quota errors during description translation
      if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure'))) {
          errorMsg = "Translation limit reached while getting description. Displaying in English.";
          setWasteDescription(originalWasteDescription); // Fallback to original English description
          currentLang = 'en'; // Revert language state if quota hit during description translation
          setSelectedLanguage('en'); // Update the global language state

          let quotaErrorTitle = "Translation Limit Reached";
           let quotaErrorDesc = "Displaying description in English due to translation limits.";
           try {
             quotaErrorTitle = await translateSingleText(quotaErrorTitle, targetLang); // Try translating error with original targetLang
             quotaErrorDesc = await translateSingleText(quotaErrorDesc, targetLang);
           } catch { /* Ignore errors translating the error message */ }

           toast({
               variant: "destructive",
               title: quotaErrorTitle,
               description: quotaErrorDesc,
               duration: 7000,
           });

      } else {
        // Other error (fetching or generic translation)
        try {
             // Try to translate the generic error message
             errorMsg = await translateSingleText(errorMsg, currentLang);
         } catch (translateErr) {
             console.error("Failed to translate description error message:", translateErr);
             // If translating the error fails, use the English default
             errorMsg = "Could not fetch or translate description.";
         }
         setWasteDescription(errorMsg); // Show translated (or default English) error

         let descErrorTitle = "Description Error";
         let descErrorDesc = "Failed to get waste description.";
         try {
           descErrorTitle = await translateSingleText(descErrorTitle, currentLang);
           descErrorDesc = await translateSingleText(descErrorDesc, currentLang);
         } catch {} // Ignore errors translating the toast message

         toast({
           variant: "destructive",
           title: descErrorTitle,
           description: descErrorDesc,
         });
      }


    } finally {
      setIsFetchingDescription(false);
    }
  }, [toast, translateSingleText, originalWasteDescription]); // Added originalWasteDescription dependency


  // Effect to fetch description when prediction changes OR language changes
  useEffect(() => {
    const currentPredictionType = manualSelection ?? prediction?.wasteType;
    if (currentPredictionType) {
        fetchDescription(currentPredictionType, selectedLanguage);
    } else {
        setWasteDescription(null);
        setOriginalWasteDescription(null);
    }
    // Cleanup speech synthesis if prediction/language changes
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, [prediction, manualSelection, selectedLanguage, fetchDescription]); // Add selectedLanguage and manualSelection

  // Effect to translate UI when language changes
  useEffect(() => {
      translateUI(selectedLanguage);
  }, [selectedLanguage, translateUI]);

  // Effect to translate existing description when language changes
   useEffect(() => {
        const translateExistingDescription = async () => {
            if (originalWasteDescription && selectedLanguage !== 'en') {
                setIsFetchingDescription(true); // Show loading while translating description
                try {
                    const translatedDesc = await translateSingleText(originalWasteDescription, selectedLanguage);
                    setWasteDescription(translatedDesc);
                } catch (err) {
                     console.error("Error translating existing description:", err);
                    // Handle quota errors specifically when changing language
                    if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure'))) {
                         setWasteDescription(originalWasteDescription); // Fallback to original English
                         setSelectedLanguage('en'); // Revert language state

                         let quotaErrorTitle = "Translation Limit Reached";
                         let quotaErrorDesc = "Displaying description in English due to translation limits.";
                          try {
                            // Try translating the toast message using the *previous* language if possible, else english
                            const previousLang = LANGUAGES.find(l => l.code !== 'en')?.code || 'en';
                            quotaErrorTitle = await translateSingleText(quotaErrorTitle, previousLang);
                            quotaErrorDesc = await translateSingleText(quotaErrorDesc, previousLang);
                          } catch {}

                         toast({
                             variant: "destructive",
                             title: quotaErrorTitle,
                             description: quotaErrorDesc,
                             duration: 7000,
                         });
                    } else {
                        // Generic error translating description
                         setWasteDescription(originalWasteDescription); // Fallback to English on other errors too
                         let genericErrorTitle = "Translation Error";
                         let genericErrorDesc = "Could not translate description. Displaying in English.";
                          try {
                             const previousLang = LANGUAGES.find(l => l.code !== 'en')?.code || 'en';
                             genericErrorTitle = await translateSingleText(genericErrorTitle, previousLang);
                             genericErrorDesc = await translateSingleText(genericErrorDesc, previousLang);
                          } catch {}
                          toast({
                             variant: "destructive",
                             title: genericErrorTitle,
                             description: genericErrorDesc,
                         });
                    }
                } finally {
                     setIsFetchingDescription(false);
                }

            } else if (originalWasteDescription && selectedLanguage === 'en') {
                setWasteDescription(originalWasteDescription); // Revert to original English
            }
        };
        // Only run if the language actually changed AND there's an original description
        if (originalWasteDescription) {
             translateExistingDescription();
        }
   }, [selectedLanguage, originalWasteDescription, translateSingleText, toast]);


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
      setPrediction(result); // This will trigger the useEffect for description fetching in the selected language
      let successMsg = "Classification Successful";
      let detectedMsg = `Detected: ${result.wasteType}`;
      try {
          successMsg = await translateSingleText(successMsg, currentLang);
          detectedMsg = await translateSingleText(detectedMsg, currentLang);
      } catch (err) {
           console.error("Error translating success toast:", err);
           // If translation fails (e.g., quota), show in English and maybe revert lang
           if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure'))) {
               successMsg = "Classification Successful"; // English fallback
               detectedMsg = `Detected: ${result.wasteType}`; // English fallback
               setSelectedLanguage('en'); // Revert language
               currentLang = 'en';
               toast({
                   variant: "destructive",
                   title: "Translation Limit Reached",
                   description: "Displaying results in English.",
                   duration: 7000,
               });
           }
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
       try {
           errorPrefix = await translateSingleText(errorPrefix, currentLang);
           // Avoid translating raw error messages from APIs
           if (errorMessage === 'An unknown error occurred during classification.') {
               errorMessage = await translateSingleText(errorMessage, currentLang);
           }
       } catch (translateErr) {
           console.error("Error translating classification error:", translateErr);
           // Fallback to English if error translation fails
           errorPrefix = "Classification failed:";
           errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during classification.';
            if (translateErr instanceof Error && (translateErr.message.includes('429') || translateErr.message.includes('QuotaFailure'))) {
               setSelectedLanguage('en'); // Revert lang on quota error
               currentLang = 'en';
               toast({
                   variant: "destructive",
                   title: "Translation Limit Reached",
                   description: "Displaying error in English.",
                   duration: 7000,
               });
           }
       }
      setError(`${errorPrefix} ${errorMessage}`);
      setPrediction(null);
      let failTitle = "Classification Failed";
      try {
        failTitle = await translateSingleText(failTitle, currentLang);
      } catch {} // Ignore failure translating toast title
      toast({
        variant: "destructive",
        title: failTitle,
        description: errorMessage, // Show potentially untranslated detailed error
      });
    } finally {
      setIsClassifying(false);
      setIsLoading(false);
    }
  }, [toast, selectedLanguage, translateSingleText]);

  const handleImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      resetState(false); // Don't clear image immediately
      let currentLang = selectedLanguage;

      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setImagePreview(URL.createObjectURL(file));
        setImageDataUri(dataUri);
        processImage(dataUri);
      };
      reader.onerror = async () => {
        let errorMsg = "Failed to read the file.";
        let errorTitle = "Error Reading File";
        let errorDesc = "Could not read the selected image file.";
        try {
             errorMsg = await translateSingleText(errorMsg, currentLang);
             errorTitle = await translateSingleText(errorTitle, currentLang);
             errorDesc = await translateSingleText(errorDesc, currentLang);
        } catch (err) {
            console.error("Error translating file read error:", err);
             // Fallback and potentially revert language on quota error
             errorMsg = "Failed to read the file.";
             errorTitle = "Error Reading File";
             errorDesc = "Could not read the selected image file.";
            if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure'))) {
               setSelectedLanguage('en'); // Revert lang on quota error
               currentLang = 'en';
               toast({
                   variant: "destructive",
                   title: "Translation Limit Reached",
                   description: "Displaying error in English.",
                   duration: 7000,
               });
           }
        }
        setError(errorMsg);
        setImagePreview(null);
        setImageDataUri(null);
        setIsLoading(false);

        toast({
          variant: "destructive",
          title: errorTitle,
          description: errorDesc,
        });
      };
      reader.readAsDataURL(file);
    }
  }, [toast, processImage, selectedLanguage, translateSingleText]);

  const handleManualSelect = async (value: string) => {
    setManualSelection(value);
    // No need to set prediction here, useEffect handles description fetching based on manualSelection
    setIsCorrecting(false);
    let manualTitle = "Manual Selection";
    let selectedDesc = `Selected: ${value}`;
    try {
        manualTitle = await translateSingleText(manualTitle, selectedLanguage);
        selectedDesc = await translateSingleText(selectedDesc, selectedLanguage);
    } catch (err) {
        console.error("Error translating manual selection toast:", err);
         // Fallback and potentially revert language on quota error
         manualTitle = "Manual Selection";
         selectedDesc = `Selected: ${value}`;
        if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure'))) {
           setSelectedLanguage('en'); // Revert lang on quota error
           toast({
               variant: "destructive",
               title: "Translation Limit Reached",
               description: "Displaying selection info in English.",
               duration: 7000,
           });
       }
    }

    toast({
      title: manualTitle,
      description: selectedDesc,
    });
    // fetchDescription(value, selectedLanguage); // Fetch description for manually selected type (Handled by useEffect)
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
    let title = 'Camera Access Previously Denied';
    let desc = 'Please enable camera permissions in your browser settings and refresh the page.';

    if (hasCameraPermission === false) {
        try {
            title = await translateSingleText(title, selectedLanguage);
            desc = await translateSingleText(desc, selectedLanguage);
        } catch (err) {
            console.error("Error translating camera denied toast:", err);
             // Fallback and potentially revert language on quota error
             title = 'Camera Access Previously Denied';
             desc = 'Please enable camera permissions in your browser settings and refresh the page.';
             if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure'))) {
                 setSelectedLanguage('en'); // Revert lang on quota error
                 toast({
                     variant: "destructive",
                     title: "Translation Limit Reached",
                     description: "Displaying message in English.",
                     duration: 7000,
                 });
             }
        }
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
        let deniedTitle = 'Camera Access Denied';
        let deniedDesc = 'Please enable camera permissions in your browser settings to use this feature.';
         try {
            deniedTitle = await translateSingleText(deniedTitle, selectedLanguage);
            deniedDesc = await translateSingleText(deniedDesc, selectedLanguage);
        } catch (err) {
            console.error("Error translating camera denied toast (catch block):", err);
             // Fallback and potentially revert language on quota error
             deniedTitle = 'Camera Access Denied';
             deniedDesc = 'Please enable camera permissions in your browser settings to use this feature.';
             if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure'))) {
                 setSelectedLanguage('en'); // Revert lang on quota error
                 toast({
                     variant: "destructive",
                     title: "Translation Limit Reached",
                     description: "Displaying message in English.",
                     duration: 7000,
                 });
             }
        }
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
    let currentLang = selectedLanguage;
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
         let errorMsg = "Could not get canvas context to capture photo.";
         let errorTitle = "Capture Error";
         let errorDesc = "Failed to get canvas context.";
          try {
             errorMsg = await translateSingleText(errorMsg, currentLang);
             errorTitle = await translateSingleText(errorTitle, currentLang);
             errorDesc = await translateSingleText(errorDesc, currentLang);
          } catch(err) {
             console.error("Error translating canvas context error:", err);
             // Fallback and potentially revert language on quota error
             errorMsg = "Could not get canvas context to capture photo.";
             errorTitle = "Capture Error";
             errorDesc = "Failed to get canvas context.";
             if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure'))) {
                 setSelectedLanguage('en'); // Revert lang on quota error
                 currentLang = 'en';
                 toast({
                     variant: "destructive",
                     title: "Translation Limit Reached",
                     description: "Displaying error in English.",
                     duration: 7000,
                 });
             }
          }
         setError(errorMsg);
          toast({
            variant: "destructive",
            title: errorTitle,
            description: errorDesc,
          });
         setShowCameraView(false); // Close dialog on error too
      }
    } else {
       let errorMsg = "Camera or canvas element not ready.";
       let errorTitle = "Capture Error";
       let errorDesc = "Camera or canvas not available.";
         try {
             errorMsg = await translateSingleText(errorMsg, currentLang);
             errorTitle = await translateSingleText(errorTitle, currentLang);
             errorDesc = await translateSingleText(errorDesc, currentLang);
         } catch(err) {
             console.error("Error translating camera/canvas ready error:", err);
              // Fallback and potentially revert language on quota error
              errorMsg = "Camera or canvas element not ready.";
              errorTitle = "Capture Error";
              errorDesc = "Camera or canvas not available.";
             if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure'))) {
                 setSelectedLanguage('en'); // Revert lang on quota error
                 currentLang = 'en';
                 toast({
                     variant: "destructive",
                     title: "Translation Limit Reached",
                     description: "Displaying error in English.",
                     duration: 7000,
                 });
             }
         }
       setError(errorMsg);
        toast({
            variant: "destructive",
            title: errorTitle,
            description: errorDesc,
        });
       setShowCameraView(false); // Close dialog on error too
    }
  }, [processImage, toast, selectedLanguage, translateSingleText]);

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
    let title = "Speech Error";
    let desc = "Text-to-speech is not available or no description to read.";

    if (!wasteDescription || typeof window === 'undefined' || !window.speechSynthesis) {
      try {
        title = await translateSingleText(title, currentLang);
        desc = await translateSingleText(desc, currentLang);
      } catch(err) {
         console.error("Error translating TTS unavailable toast:", err);
         // Fallback and potentially revert language on quota error
         title = "Speech Error";
         desc = "Text-to-speech is not available or no description to read.";
         if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure'))) {
             setSelectedLanguage('en'); // Revert lang on quota error
             currentLang = 'en';
             toast({
                 variant: "destructive",
                 title: "Translation Limit Reached",
                 description: "Displaying message in English.",
                 duration: 7000,
             });
         }
      }
      toast({
        variant: "destructive",
        title: title,
        description: desc,
      });
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel(); // Clear any previous utterances

      const utterance = new SpeechSynthesisUtterance(wasteDescription);
      const langConfig = LANGUAGES.find(l => l.code === currentLang);
      utterance.lang = langConfig ? langConfig.ttsLang : 'en-US'; // Use mapped TTS lang code
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = async (event) => {
        console.error("Speech synthesis error:", event.error);
        setIsSpeaking(false);
        let errorTitle = "Speech Error";
        let errorDesc = `Could not read aloud: ${event.error}`;
        try {
            errorTitle = await translateSingleText(errorTitle, currentLang);
            errorDesc = await translateSingleText(`Could not read aloud`, currentLang) + `: ${event.error}`;
        } catch (err) {
             console.error("Error translating TTS error toast:", err);
             // Fallback and potentially revert language on quota error
             errorTitle = "Speech Error";
             errorDesc = `Could not read aloud: ${event.error}`;
             if (err instanceof Error && (err.message.includes('429') || err.message.includes('QuotaFailure'))) {
                 setSelectedLanguage('en'); // Revert lang on quota error
                 currentLang = 'en';
                 toast({
                     variant: "destructive",
                     title: "Translation Limit Reached",
                     description: "Displaying error in English.",
                     duration: 7000,
                 });
             }
        }
        toast({
          variant: "destructive",
          title: errorTitle,
          description: errorDesc,
        });
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  }, [wasteDescription, isSpeaking, toast, selectedLanguage, translateSingleText]);

  // Get current language name for the dropdown display
  const currentLanguageName = LANGUAGES.find(l => l.code === selectedLanguage)?.name || 'Language';

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
                <p className="text-muted-foreground">{isTranslating ? '...' : translatedTexts.classifying}</p>
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
           <AlertTitle>{isTranslating ? '...' : translatedTexts.errorTitle}</AlertTitle>
           <AlertDescription>{error}</AlertDescription> {/* Error message itself is potentially already translated */}
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
              <div className={`space-y-2 border-l-4 p-4 rounded ${prediction ? getConfidenceColor(prediction.confidence) : 'border-primary'} bg-card`}>
                <p className="text-sm text-muted-foreground">{isTranslating ? '...' : translatedTexts.detectedTypeLabel}</p>
                <p className="text-3xl font-semibold">{manualSelection ?? prediction?.wasteType}</p>
                {prediction && !manualSelection && ( // Only show confidence if it's a prediction, not manual override
                    <p className="text-sm text-muted-foreground">
                        {isTranslating ? '...' : translatedTexts.confidenceLabel} {(prediction.confidence * 100).toFixed(1)}%
                    </p>
                 )}
                 {!manualSelection && ( // Only show correction link if not manually selected
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

          {/* Details Section - Show if NOT correcting and prediction/manual selection exists */}
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
                    disabled={isFetchingDescription || !wasteDescription || isLoading || isTranslating || isSpeaking} // Also disable while speaking
                    className="text-primary hover:bg-accent disabled:opacity-50"
                    aria-label={isSpeaking ? (isTranslating ? '...' : translatedTexts.stopReadingButtonLabel) : (isTranslating ? '...' : translatedTexts.readAloudButtonLabel)}
                  >
                    {isSpeaking ? <StopCircle className="h-5 w-5 animate-pulse text-red-500" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
              </div>

               <div className="text-muted-foreground w-full min-h-[40px]">
                 {isFetchingDescription || (isTranslating && !wasteDescription) ? ( // Show loader if fetching OR translating UI *and* no description yet
                   <div className="flex items-center gap-2">
                     <Loader2 className="h-4 w-4 animate-spin" />
                     <span>{isTranslating ? '...' : translatedTexts.fetchingDescription}</span>
                   </div>
                 ) : wasteDescription ? (
                   <p>{wasteDescription}</p>
                 ) : (
                   <p className="italic">{isTranslating ? '...' : translatedTexts.noDescription}</p>
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
