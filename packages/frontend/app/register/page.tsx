import { RegisterForm } from "./RegisterForm";
import AuthShell from "@/components/AuthShell";
export default function Page() {
  return (
    <AuthShell
      title="Start making progress."
      description="Create your account to build a vocabulary you can use."
    >
      <RegisterForm />
    </AuthShell>
  );
}
