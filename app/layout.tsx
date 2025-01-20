import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { ThemeProvider } from '@/components/theme-provider';
import React, { ReactNode } from 'react';
import AppWrapper from 'jrgcomponents/AppWrapper/Wrapper/Themed';
import Head from 'jrgcomponents/Head';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME,
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  const cookieStore = cookies();

  return (
    <html lang='en' suppressHydrationWarning>
      <Head />
      <body className={inter.className}>
        <ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange>
          <AppWrapper
            themeConfig={{
              defaultTheme: {
                dark: cookieStore.get('dark')?.value
                  ? cookieStore.get('dark')?.value === 'true'
                  : process.env.NEXT_PUBLIC_DEFAULT_THEME_MODE === 'dark',
                colorblind: cookieStore.get('colorblind')?.value === 'true',
              },
            }}
            appWrapperConfig={{
              header: {},
              footer: {
                components: {
                  center: (
                    <div>
                      <span>&copy; Jameson R Grieve 2024</span>
                    </div>
                  ),
                },
              },
            }}
          >
            {children}
          </AppWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
