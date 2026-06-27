import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wordmark } from '@/components/layout/wordmark';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-3 text-center">
          <Wordmark className="text-2xl" />
          <CardTitle className="font-normal text-muted-foreground">
            Entre com seu e-mail e senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
