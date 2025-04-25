'use client';

import type { ChangeEvent } from 'react';
import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, Leaf, Pencil, RotateCcw, AlertCircle, Loader2, Info } from 'lucide-react'; // Added Info, Loader2
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
  const [error, setError] = useState<string | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [manualSelection, setManualSelection] = useState<string | null>(null);
  const { toast } = useToast();

   // Fetch description when prediction changes
   useEffect(() => {
    if (prediction?.wasteType) {
      fetchDescription(prediction.wasteType);
    } else {
      setWasteDescription(null); // Clear description if no prediction
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prediction]); // Dependency on prediction object

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


  const handleImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Reset previous state
      resetState(false); // Don't clear image immediately

      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setImagePreview(URL.createObjectURL(file)); // For display
        setImageDataUri(dataUri); // For sending to AI

        setIsLoading(true);
        setError(null);
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
          setPrediction(null); // Clear previous prediction on error
          toast({
            variant: "destructive",
            title: "Classification Failed",
            description: errorMessage,
          });
        } finally {
          setIsLoading(false);
        }
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
  }, [toast]);

  const handleManualSelect = (value: string) => {
    setManualSelection(value);
    // Update the "prediction" to reflect the manual choice for consistency
    setPrediction({ wasteType: value, confidence: 1.0 }); // Assume 100% confidence for manual selection
    setIsCorrecting(false);
    toast({
      title: "Manual Selection",
      description: `Selected: ${value}`,
    });
    // Fetch description for manually selected type
    // fetchDescription(value); // This is handled by the useEffect now
  };

  const resetState = (clearImage: boolean = true) => {
    if (clearImage) {
      setImagePreview(null);
      setImageDataUri(null);
       // Clear file input value if applicable (requires ref)
       const fileInput = document.getElementById('file-upload') as HTMLInputElement;
       if (fileInput) {
         fileInput.value = '';
       }
    }
    setPrediction(null);
    setWasteDescription(null); // Clear description
    setIsFetchingDescription(false); // Reset description loading state
    setError(null);
    setIsLoading(false);
    setIsCorrecting(false);
    setManualSelection(null);
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.8) return 'border-green-500'; // High confidence
    if (confidence > 0.5) return 'border-yellow-500'; // Medium confidence
    return 'border-red-500'; // Low confidence
  };

  return (
    <div className="flex flex-col items-center space-y-6 md:space-y-8">
      <h1 className="text-3xl md:text-4xl font-bold text-center text-primary">AS SAATHI - Agricultural Waste Detector</h1>

      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <UploadCloud className="text-primary" />
            Snap or Upload Waste Photo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-center md:items-start">
          <div className="flex flex-col sm:flex-row md:flex-col gap-4 w-full md:w-auto">
             {/* Hidden file input */}
             <input
                type="file"
                id="file-upload"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                disabled={isLoading}
              />
             {/* "Upload Photo" Button - Triggers file input */}
            <Button
              variant="outline"
              className="border-2 border-dashed border-primary text-primary hover:bg-accent hover:text-accent-foreground w-full sm:w-auto md:w-full"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={isLoading}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              {imagePreview ? 'Change Photo' : 'Upload Photo'}
            </Button>
              {/* Add placeholder for "Take a Photo" if needed */}
              {/* <Button variant="outline" className="border-2 border-dashed border-primary text-primary hover:bg-accent hover:text-accent-foreground w-full sm:w-auto md:w-full" disabled>
                <Camera className="mr-2 h-4 w-4" />
                Take a Photo (Not Impl.)
              </Button> */}
          </div>
          <div
            className={`flex-grow w-full h-48 md:h-64 rounded-md flex items-center justify-center bg-[hsl(var(--image-preview-bg))] p-2 border border-dashed ${imagePreview ? 'border-primary' : 'border-gray-300'}`}
          >
            {isLoading ? (
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">Processing...</p>
                <Progress value={undefined} className="w-3/4 mx-auto" /> {/* Removed animation, handled by component */}
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

      {error && (
         <Alert variant="destructive" className="w-full max-w-3xl shadow-md">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>Error</AlertTitle>
           <AlertDescription>{error}</AlertDescription>
         </Alert>
      )}

      {(prediction || isCorrecting) && (
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
                 <Select onValueChange={handleManualSelect} value={manualSelection ?? ''}>
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
                 <Button variant="outline" size="sm" onClick={() => setIsCorrecting(false)}>Cancel</Button>
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
                  onClick={() => setIsCorrecting(true)}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Not correct? Select manually
                </Button>
              </div>
            ) : null}
          </CardContent>
          {/* Details Section */}
          {prediction && (
            <CardFooter className="flex flex-col items-start space-y-4 border-t pt-4">
               <h3 className="text-lg font-semibold flex items-center gap-2">
                 <Info className="text-primary h-5 w-5" />
                 Details
               </h3>
               <div className="text-muted-foreground w-full min-h-[40px]">
                 {isFetchingDescription ? (
                   <div className="flex items-center gap-2">
                     <Loader2 className="h-4 w-4 animate-spin" />
                     <span>Fetching description...</span>
                   </div>
                 ) : wasteDescription ? (
                   <p>{wasteDescription}</p>
                 ) : (
                   <p className="italic">No description available.</p> // Placeholder if description is null/empty
                 )}
               </div>
               {/* Placeholder for Translation and TTS */}
               {/* <div className="flex justify-between w-full items-center pt-4 border-t mt-4">
                 <Button variant="ghost" size="icon" className="text-primary hover:bg-accent">
                   <Volume2 className="h-5 w-5" />
                   <span className="sr-only">Read aloud</span>
                 </Button>
                 <div className="flex items-center gap-2">
                   <Label htmlFor="language-select" className="text-sm">Translate Info:</Label>
                   <Select>
                     <SelectTrigger id="language-select" className="w-[150px]">
                       <SelectValue placeholder="English" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="en">English</SelectItem>
                       <SelectItem value="hi">Hindi</SelectItem>
                       <SelectItem value="mr">Marathi</SelectItem>
                       <SelectItem value="ta">Tamil</SelectItem>
                       <SelectItem value="te">Telugu</SelectItem>
                       <SelectItem value="bn">Bengali</SelectItem>
                       <SelectItem value="kn">Kannada</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div> */}
             </CardFooter>
           )}
        </Card>
      )}

      <Button
        onClick={() => resetState(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={isLoading}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Reset
      </Button>
    </div>
  );
}
