import { MagicLinkForm } from "./MagicLinkForm";
import AuthShell from "@/components/AuthShell";
export default function Page() {
  return (
    <AuthShell
      title="A simple way back in."
      description="Get a sign-in link sent to your email."
    >
      <MagicLinkForm />
    </AuthShell>
  );
}
