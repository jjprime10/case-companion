## Diagnóstico

O master (laura@gmail.com) está correto. Os outros dois usuários (jean, karen) cadastraram-se pela aba "Cadastrar" da tela de login. O trigger `handle_new_user` só atribui `master` ao **primeiro** usuário — todos os demais ficam sem função, e por isso aparecem como "Sem função" no painel de Usuários e perdem acesso a qualquer tela (RLS exige um `app_role`).

Esse é o comportamento correto para um app interno: ninguém deve poder criar conta sozinho. O master é quem cria usuários e define a função na tela **Usuários & Permissões**.

## Plano

1. **Remover o cadastro público da tela de login** (`src/routes/login.tsx`)
   - Remover as abas Entrar/Cadastrar e o formulário `handleSignUp`.
   - Deixar apenas o formulário de login com e-mail e senha.
   - Trocar o texto do card para algo como "Acesso restrito — solicite credenciais ao administrador."

2. **Desabilitar signup no backend** via `configure_auth` (`disable_signup: true`) para garantir que nem chamadas diretas à API consigam criar conta. O master continua criando usuários pela Admin API (`createUser` em `admin.functions.ts`), que ignora essa flag.

3. **Limpar os usuários órfãos atuais** (jean e karen) — apagar via `auth.admin.deleteUser`, já que foram cadastros de teste sem função. Se você preferir manter algum deles, posso em vez disso atribuir uma função (Advogado / Assistente / Visualizador) na tela de Usuários.

4. **Mensagem na tela de Usuários** — pequeno aviso reforçando que novos acessos só são criados ali pelo master.

## Pergunta antes de implementar

Sobre **jean** e **karen** (cadastrados sem função): você quer que eu **apague os dois** ou **mantenha e atribua uma função** a cada um? Se for atribuir, me diga qual função para cada (Master / Advogado / Assistente / Visualizador).
