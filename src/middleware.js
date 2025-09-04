import { NextResponse } from 'next/server';

// Middleware to protect sensitive routes
export function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Protected routes that require authentication
  const protectedRoutes = [
    '/dashboard',
    '/deploy',
    '/test'
  ];
  
  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  if (isProtectedRoute) {
    // For protected routes, we'll let the client-side SecureRoute handle authentication
    // This middleware ensures the route exists and can be accessed
    // The actual authentication is handled by the SecureRoute component
    
    // Check if user is accessing from a legitimate source
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    
    // Basic bot/spider protection
    if (userAgent.includes('bot') || userAgent.includes('spider') || userAgent.includes('crawler')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    // Allow the request to proceed - authentication will be handled by SecureRoute
    return NextResponse.next();
  }
  
  // For non-protected routes, proceed normally
  return NextResponse.next();
}

// Configure which routes this middleware should run on
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/deploy/:path*',
    '/test/:path*'
  ]
};
