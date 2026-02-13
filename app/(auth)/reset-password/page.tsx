import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        重置密码
      </h1>
      <ResetPasswordForm />
    </div>
  );
}
