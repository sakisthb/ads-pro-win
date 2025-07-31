// Authentication Configuration for Ads Pro Enterprise
// AI-Powered Marketing Intelligence Platform

import { getAuth } from "@clerk/nextjs/server";
import { type GetServerSidePropsContext } from "next";

// Custom session type for Clerk
interface CustomSession {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
    emailVerified?: boolean;
  };
  expires: string;
}

export const getServerAuthSession = async (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}): Promise<CustomSession | null> => {
  try {
    const { userId } = await getAuth(ctx.req);
    
    if (!userId) {
      return null;
    }

    // Convert Clerk user to session format
    const session: CustomSession = {
      user: {
        id: userId,
        email: "", // Will be fetched from database if needed
        name: "", // Will be fetched from database if needed
        image: "", // Will be fetched from database if needed
        emailVerified: true, // Clerk handles email verification
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    return session;
  } catch (error) {
    console.error("Error getting auth session:", error);
    return null;
  }
}; 