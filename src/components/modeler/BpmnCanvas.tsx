import { useRef, useEffect } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BpmnCanvasProps {
  isLoaded: boolean;
  modelerRef: React.MutableRefObject<BpmnModeler | null>;
  onLoad: () => void;
  onError: (error: string) => void;
  defaultXml: string;
}

export function BpmnCanvas({ isLoaded, modelerRef, onLoad, onError, defaultXml }: BpmnCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize BPMN Modeler
    const modeler = new BpmnModeler({
      container: containerRef.current,
      keyboard: {
        bindTo: window
      }
    });

    modelerRef.current = modeler;

    // Load default diagram
    modeler.importXML(defaultXml).then(() => {
      onLoad();
    }).catch((err) => {
      console.error('Error loading default diagram:', err);
      onError("Failed to initialize the modeler.");
    });

    // Handle drop events for palette items
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer?.getData("application/json");
      if (data) {
        try {
          const item = JSON.parse(data);
          console.log('Dropped BPMN element:', item);
          // Here you would implement the logic to add the element to the diagram
          // This requires more complex integration with bpmn.io's modeling APIs
        } catch (err) {
          console.error('Error parsing dropped data:', err);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";
    };

    const container = containerRef.current;
    container.addEventListener('drop', handleDrop);
    container.addEventListener('dragover', handleDragOver);

    return () => {
      container.removeEventListener('drop', handleDrop);
      container.removeEventListener('dragover', handleDragOver);
      modeler.destroy();
    };
  }, [defaultXml, modelerRef, onLoad, onError]);

  return (
    <div className="flex-1 relative">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Loading Modeler</CardTitle>
              <CardDescription>
                Initializing BPMN 2.0 modeler...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div 
        ref={containerRef} 
        className="w-full h-full bg-background"
        style={{ minHeight: '600px' }}
      />
    </div>
  );
}