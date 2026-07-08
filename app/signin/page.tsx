import { PageHeader } from "@/components/PageHeader";

export default function SignInPage() {
  return (
    <>
      <PageHeader title="Sign In" subtitle="Front-end gate for the AR manager demo." />
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">This screen is ready for the login flow.</p>
      </div>
    </>
  );
}
