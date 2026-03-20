import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { savedLocationsStore } from "@/lib/local-data";
import { useAuth } from "@/lib/AuthContext";

export default function DeleteAccountModal() {
  const [isDeleting, setIsDeleting] = useState(false);
  const { logout } = useAuth();

  const handleDelete = async () => {
    setIsDeleting(true);
    savedLocationsStore.clear();
    logout("/");
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <Trash2 className="w-4 h-4" />
          Clear Local Data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear local data?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes your saved locations from this browser and resets the local session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Yes, clear local data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
