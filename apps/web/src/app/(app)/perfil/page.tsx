import { User } from 'lucide-react';
import { PreviewPlaceholder } from '@/components/layout/preview-placeholder';

export default function PerfilPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Perfil</h1>
      <PreviewPlaceholder
        icone={User}
        titulo="Perfil"
        descricao="Edite seus dados pessoais, foto e preferências de conta — disponível em breve."
      />
    </>
  );
}
