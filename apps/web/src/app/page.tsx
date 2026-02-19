import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function HomePage() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (!clerkEnabled) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="panel max-w-xl w-full rounded-2xl p-8 space-y-4">
          <h1 className="text-3xl font-semibold">Weaveflow</h1>
          <p className="text-sm text-slate-300">Clerk keys are not configured. Add Clerk env vars to enable authentication.</p>
          <Link className="button" href="/workflow">
            Open workflow builder
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="panel max-w-xl w-full rounded-2xl p-8 space-y-4">
        <h1 className="text-3xl font-semibold">Weaveflow</h1>
        <p className="text-sm text-slate-300">
          Pixel-precise LLM workflow builder with React Flow, Trigger.dev, Gemini, Clerk, and Prisma.
        </p>
        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton>
              <button className="button">Sign in</button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link className="button" href="/workflow">
              Open workflow builder
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>
    </main>
  );
}