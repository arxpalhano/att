import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      // Sem isto, quem sai do portal e clica em "Entrar com Microsoft" volta
      // direto na mesma conta: a sessão no Entra continua aberta e o login é
      // silencioso — o usuário jura que o logout não funcionou. O seletor de
      // conta também é o que permite trocar de usuário na mesma máquina.
      // (Encerramos só a sessão do portal; a do Microsoft no navegador segue,
      // como em qualquer app corporativo.)
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.email = profile?.email ?? token.email;
        token.name = profile?.name ?? token.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/portal",
  },
});

export { handler as GET, handler as POST };
