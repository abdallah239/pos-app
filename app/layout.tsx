import './globals.css';
import { Inter } from 'next/font/google';
import { useState, useEffect } from 'react';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="font-sans antialiased bg-gray-50 min-h-screen">
        <div className="flex min-h-screen">
          {/* Sidebar Navigation */}
          <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">POS Dashboard</h2>
            </div>

            <nav className="mt-6 space-y-2">
              <a
                href="/dashboard"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="stroke-2" d="M3 12l2-2m6 4l2-2m7.01-4.99a1 1 0 010 1.41l-2 2m-2.01 7l2 2M5.585 5.585a1 1 0 111.414-1.414L15 8.586M5 12l2-2m6 4l2 2m7.01-4.99a1 1 0 01-1.41 0l-2 2m0 0a1 1 0 011.414 1.41l2-2M9.98 9.98a1 1 0 011.41 0l2 2m-2.02 2.02a1 1 0 01-1.414 0l-2-2m0 0a1 1 0 010 1.414l2 2m-6.98 6.98a1 1 0 01-1.414 0l-2-2m6.98.02a1 1 0 011.414 0l2 2M15 15a3 3 0 110-6 3 3 0 010 6z"></path>
                </svg>
                Dashboard
              </a>

              <a
                href="/products"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="stroke-2" d="M12 6v6l4 2-4 2v-6l-4-2 4-2z"></path>
                </svg>
                Products
              </a>

              <a
                href="/cashier"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="stroke-2" d="M12 6v6l4 2-4 2v-6l-4-2 4-2z"></path>
                </svg>
                Cashier
              </a>
            </nav>
          </aside>

          {/* Main Content */}
          <div className="flex-1 p-8">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}