import { SignIn } from "@clerk/nextjs";
import { AuthShell, clerkLook } from "@/components/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn appearance={clerkLook} />
    </AuthShell>
  );
}
