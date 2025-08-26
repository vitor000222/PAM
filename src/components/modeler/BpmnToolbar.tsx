import { Button } from "@/components/ui/button";
import { Upload, Download, Save, FileX, CheckCircle } from "lucide-react";

interface BpmnToolbarProps {
  isLoaded: boolean;
  onNew: () => void;
  onUpload: () => void;
  onDownload: () => void;
  onSave: () => void;
  onValidate?: () => void;
}

export function BpmnToolbar({ 
  isLoaded, 
  onNew, 
  onUpload, 
  onDownload, 
  onSave,
  onValidate 
}: BpmnToolbarProps) {
  return (
    <div className="border-b border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">BPMN Modeler</h1>
          <p className="text-sm text-muted-foreground">Create and edit BPMN 2.0 diagrams</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onNew}
            disabled={!isLoaded}
          >
            <FileX className="w-4 h-4 mr-2" />
            New
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onUpload}
            disabled={!isLoaded}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onDownload}
            disabled={!isLoaded}
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>

          {onValidate && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onValidate}
              disabled={!isLoaded}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Validate
            </Button>
          )}
          
          <Button 
            size="sm" 
            onClick={onSave}
            disabled={!isLoaded}
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}