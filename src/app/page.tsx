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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Added Dialog components
import { UploadCloud, Leaf, Pencil, RotateCcw, AlertCircle, Loader2, Info, Camera, VideoOff, Volume2, StopCircle } from 'lucide-react'; // Added Camera, VideoOff, Volume2, StopCircle
import Image from 'next/image';
import { classifyWaste, type ClassifyWasteOutput } from '@/ai/flows/classify-waste';
import { getWasteDescription } from '@/ai/flows/get-waste-description'; // Import the new flow
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

export default function AgriWastePage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<ClassifyWasteOutput | null>(null);
  const [wasteDescription, setWasteDescription] = useState<string | null>(null); // State for description
  const [isFetchingDescription, setIsFetchingDescription] = useState(false); // Loading state for description
  const [isLoading, setIsLoading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false); // Specific loading state for classification
  const [error, setError] = useState<string | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [manualSelection, setManualSelection] = useState<string | null>(null);
  const [showCameraView, setShowCameraView] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false); // State for TTS
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Ref for canvas element
  const streamRef = useRef<MediaStream | null>(null); // Ref to store the stream
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null); // Ref for utterance
  const { toast } = useToast();

   // Fetch description when prediction changes
   useEffect(() => {
    if (prediction?.wasteType && !isCorrecting) { // Only fetch if not correcting
      fetchDescription(prediction.wasteType);
    } else {
      setWasteDescription(null); // Clear description if no prediction or correcting
    }
    // Cleanup speech synthesis if prediction changes or correcting starts
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prediction, isCorrecting]); // Dependency on prediction object and correction state

  const fetchDescription = useCallback(async (wasteType: string) => {
    setIsFetchingDescription(true);
    setWasteDescription(null); // Clear previous description
    try {
      const result = await getWasteDescription({ wasteType });
      setWasteDescription(result.description);
    } catch (err) {
      console.error("Description fetching error:", err);
      setWasteDescription("Could not fetch description."); // Show error message in description area
      toast({
        variant: "destructive",
        title: "Description Error",
        description: "Failed to fetch waste description.",
      });
    } finally {
      setIsFetchingDescription(false);
    }
  }, [toast]);

  const processImage = useCallback(async (dataUri: string) => {
    setIsClassifying(true); // Set classifying state
    setIsLoading(true); // Keep general loading state for UI disabling
    setError(null);
    setPrediction(null); // Clear previous prediction
    setWasteDescription(null); // Clear previous description
    setIsCorrecting(false); // Ensure correction mode is off

    try {
      const result = await classifyWaste({ photoDataUri: dataUri });
      setPrediction(result); // This will trigger the useEffect for description fetching
      toast({
        title: "Classification Successful",
        description: `Detected: ${result.wasteType}`,
      });
    } catch (err) {
      console.error("Classification error:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during classification.';
      setError(`Classification failed: ${errorMessage}`);
      setPrediction(null);
      toast({
        variant: "destructive",
        title: "Classification Failed",
        description: errorMessage,
      });
    } finally {
      setIsClassifying(false); // Reset classifying state
      setIsLoading(false); // Reset general loading state
    }
  }, [toast]);

  const handleImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      resetState(false); // Don't clear image immediately, but clear predictions etc.

      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setImagePreview(URL.createObjectURL(file)); // For display
        setImageDataUri(dataUri); // For sending to AI
        processImage(dataUri); // Process the image
      };
      reader.onerror = () => {
        setError("Failed to read the file.");
        setImagePreview(null);
        setImageDataUri(null);
        setIsLoading(false);
        toast({
          variant: "destructive",
          title: "Error Reading File",
          description: "Could not read the selected image file.",
        });
      };
      reader.readAsDataURL(file);
    }
  }, [toast, processImage]);

  const handleManualSelect = (value: string) => {
    setManualSelection(value);
    setPrediction({ wasteType: value, confidence: 1.0 }); // Update prediction state
    setIsCorrecting(false);
    toast({
      title: "Manual Selection",
      description: `Selected: ${value}`,
    });
     // Fetch description for manually selected type (handled by useEffect)
  };

  const resetState = (clearImage: boolean = true) => {
    if (clearImage) {
      setImagePreview(null);
      setImageDataUri(null);
      // Clear file input value
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
    setPrediction(null);
    setWasteDescription(null);
    setIsFetchingDescription(false);
    setError(null);
    setIsLoading(false);
    setIsClassifying(false);
    setIsCorrecting(false);
    setManualSelection(null);
    // Stop TTS on reset
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.8) return 'border-green-500'; // High confidence
    if (confidence > 0.5) return 'border-yellow-500'; // Medium confidence
    return 'border-red-500'; // Low confidence
  };

  // ---- Camera Functionality ----

  const requestCameraPermission = async () => {
    if (hasCameraPermission === false) {
        toast({
            variant: 'destructive',
            title: 'Camera Access Previously Denied',
            description: 'Please enable camera permissions in your browser settings and refresh the page.',
        });
        return false;
    }
    if (hasCameraPermission === true) return true; // Already granted

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream; // Store the stream
        setHasCameraPermission(true);
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
        return true;
    } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings to use this feature.',
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

  const handleCapturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame onto canvas
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get data URI from canvas
        const dataUri = canvas.toDataURL('image/jpeg'); // Or 'image/png'

        // Update state and process
        resetState(false); // Clear previous results but keep camera open if needed
        setImagePreview(dataUri);
        setImageDataUri(dataUri);
        processImage(dataUri);

        // Close camera view and stop stream
        setShowCameraView(false);

      } else {
         setError("Could not get canvas context to capture photo.");
          toast({
            variant: "destructive",
            title: "Capture Error",
            description: "Failed to get canvas context.",
          });
      }
    } else {
       setError("Camera or canvas element not ready.");
        toast({
            variant: "destructive",
            title: "Capture Error",
            description: "Camera or canvas not available.",
        });
    }
  }, [processImage, toast]);


  // Effect to stop camera stream when dialog is closed or component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        console.log("Camera stream stopped.");
      }
      // Cleanup speech synthesis on unmount
      window.speechSynthesis?.cancel();
    };
  }, []);

   // Effect to manage stream when dialog opens/closes
   useEffect(() => {
    if (showCameraView) {
      // Ensure permission is requested again if needed, or stream is started
      requestCameraPermission().then(granted => {
        if (granted && videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(err => console.error("Video play error:", err));
        } else if (!granted) {
            // If permission was denied after opening dialog, close it
             setShowCameraView(false);
        }
      });
    } else {
      // Stop stream tracks when dialog closes
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null; // Clear the ref
         if (videoRef.current) {
           videoRef.current.srcObject = null; // Clear video source
         }
        console.log("Camera stream stopped on dialog close.");
      }
    }
  }, [showCameraView]);

  // ---- Text-to-Speech Functionality ----
  const handleReadAloud = useCallback(() => {
    if (!wasteDescription || typeof window === 'undefined' || !window.speechSynthesis) {
      toast({
        variant: "destructive",
        title: "Speech Error",
        description: "Text-to-speech is not available or no description to read.",
      });
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      // Cancel any previous speech before starting new one
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(wasteDescription);
      utterance.lang = 'en-US'; // Default to English
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event.error);
        setIsSpeaking(false);
        toast({
          variant: "destructive",
          title: "Speech Error",
          description: `Could not read aloud: ${event.error}`,
        });
      };
      utteranceRef.current = utterance; // Store utterance if needed for future controls
      window.speechSynthesis.speak(utterance);
    }
  }, [wasteDescription, isSpeaking, toast]);


  return (
    <div className="flex flex-col items-center space-y-6 md:space-y-8">
      <h1 className="text-3xl md:text-4xl font-bold text-center text-primary">SAATHI - Agricultural Waste Detector</h1>

       {/* Hidden Canvas for Capturing Photo */}
       <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <UploadCloud className="text-primary" />
            Snap or Upload Waste Photo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-center md:items-start">
          {/* Button Container */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-4 w-full md:w-auto shrink-0">
             {/* Hidden file input */}
             <input
                type="file"
                id="file-upload"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                disabled={isLoading || isClassifying}
              />
             {/* "Upload Photo" Button */}
            <Button
              variant="outline"
              className="border-2 border-dashed border-primary text-primary hover:bg-accent hover:text-accent-foreground w-full sm:w-auto md:w-full"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={isLoading || isClassifying}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              {imagePreview ? 'Change Upload' : 'Upload Photo'}
            </Button>
             {/* "Take a Photo" Button */}
            <Button
                variant="default" // Solid button
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto md:w-full"
                onClick={handleTakePhotoClick}
                disabled={isLoading || isClassifying || hasCameraPermission === false} // Disable if loading or permission denied
            >
                <Camera className="mr-2 h-4 w-4" />
                Take a Photo
            </Button>
             {hasCameraPermission === false && (
                <p className="text-xs text-destructive text-center md:text-left">Camera access denied.</p>
            )}
          </div>
          {/* Image Preview Box */}
          <div
            className={`flex-grow w-full h-48 md:h-64 rounded-md flex items-center justify-center bg-[hsl(var(--image-preview-bg))] p-2 border border-dashed ${imagePreview ? 'border-primary' : 'border-gray-300'}`}
          >
            {isClassifying ? ( // Use isClassifying here
              <div className="text-center space-y-2">
                 <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Classifying...</p>
                {/* <Progress value={undefined} className="w-3/4 mx-auto" /> */}
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
              <p className="text-muted-foreground text-center">Image preview will appear here</p>
            )}
          </div>
        </CardContent>
      </Card>

        {/* Camera View Dialog */}
      <Dialog open={showCameraView} onOpenChange={setShowCameraView}>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
            <DialogTitle>Take a Photo</DialogTitle>
            </DialogHeader>
            <div className="my-4">
            {/* Video Element */}
            <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay muted playsInline />

            {/* Permission Status Messages */}
             {hasCameraPermission === null && (
                <div className="mt-2 text-center text-muted-foreground">Requesting camera access...</div>
            )}
            {hasCameraPermission === false && (
                <Alert variant="destructive" className="mt-4">
                    <VideoOff className="h-4 w-4"/>
                    <AlertTitle>Camera Access Denied</AlertTitle>
                    <AlertDescription>
                        Please allow camera access in your browser settings and refresh the page to use this feature.
                    </AlertDescription>
                </Alert>
            )}
            </div>
            <DialogFooter>
             <DialogClose asChild>
                 <Button type="button" variant="outline">Cancel</Button>
             </DialogClose>
            <Button type="button" onClick={handleCapturePhoto} disabled={!hasCameraPermission}>
                <Camera className="mr-2 h-4 w-4" />
                Capture Photo
            </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      {error && (
         <Alert variant="destructive" className="w-full max-w-3xl shadow-md">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>Error</AlertTitle>
           <AlertDescription>{error}</AlertDescription>
         </Alert>
      )}

      {/* Prediction and Details Card */}
      {(prediction || isCorrecting) && !isClassifying && (
        <Card className="w-full max-w-3xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Leaf className="text-primary" />
              Waste Detector
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCorrecting ? (
               <div className="space-y-2">
                 <Label htmlFor="manual-waste-select">Select Correct Waste Type:</Label>
                 <Select onValueChange={handleManualSelect} value={manualSelection ?? prediction?.wasteType ?? ''}>
                   <SelectTrigger id="manual-waste-select" className="w-full">
                     <SelectValue placeholder="Choose waste type..." />
                   </SelectTrigger>
                   <SelectContent>
                     {WASTE_TYPES.map((type) => (
                       <SelectItem key={type} value={type}>
                         {type}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setIsCorrecting(false)}>Cancel</Button>
                  {/* Optionally add a "Confirm Correction" button if needed */}
                  </div>
               </div>
            ) : prediction ? (
              <div className={`space-y-2 border-l-4 p-4 rounded ${getConfidenceColor(prediction.confidence)} bg-card`}>
                <p className="text-sm text-muted-foreground">Detected Type:</p>
                <p className="text-3xl font-semibold">{prediction.wasteType}</p>
                <p className="text-sm text-muted-foreground">
                  Confidence: {(prediction.confidence * 100).toFixed(1)}%
                </p>
                 <Button
                  variant="link"
                  className="p-0 h-auto text-sm text-primary hover:underline"
                  onClick={() => {
                    setIsCorrecting(true);
                    setManualSelection(prediction.wasteType); // Pre-fill select with current prediction
                  }}
                  disabled={isLoading}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Not correct? Select manually
                </Button>
              </div>
            ) : null}
          </CardContent>
          {/* Details Section - only show if NOT correcting and prediction exists */}
          {prediction && !isCorrecting && (
            <CardFooter className="flex flex-col items-start space-y-4 border-t pt-4">
              <div className="flex items-center justify-between w-full">
                 <h3 className="text-lg font-semibold flex items-center gap-2">
                   <Info className="text-primary h-5 w-5" />
                   Details
                 </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReadAloud}
                    disabled={isFetchingDescription || !wasteDescription || isLoading}
                    className="text-primary hover:bg-accent disabled:opacity-50"
                    aria-label={isSpeaking ? "Stop reading" : "Read description aloud"}
                  >
                    {isSpeaking ? <StopCircle className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
              </div>

               <div className="text-muted-foreground w-full min-h-[40px]">
                 {isFetchingDescription ? (
                   <div className="flex items-center gap-2">
                     <Loader2 className="h-4 w-4 animate-spin" />
                     <span>Fetching description...</span>
                   </div>
                 ) : wasteDescription ? (
                   <p>{wasteDescription}</p>
                 ) : (
                   <p className="italic">No description available.</p>
                 )}
               </div>
               {/* Placeholder for Translation (Future Feature) */}
               {/*
               <div className="flex justify-end w-full items-center pt-4 border-t mt-4 opacity-50">
                 <div className="flex items-center gap-2">
                   <Label htmlFor="language-select" className="text-sm">Translate Info:</Label>
                   <Select disabled>
                     <SelectTrigger id="language-select" className="w-[150px]">
                       <SelectValue placeholder="English" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="en">English</SelectItem>
                       <SelectItem value="hi">Hindi</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
               */}
             </CardFooter>
           )}
        </Card>
      )}

        {/* Reset Button */}
      <Button
        onClick={() => resetState(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={isLoading || isClassifying}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Reset
      </Button>
    </div>
  );
}
