import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { code, referrer } = await request.json();
    const redirectUri = referrer || process.env.REDIRECT_URI || process.env.AUTH_WEB;

    const auth = new GoogleOAuth();
    const result = await auth.handleCallback(code, redirectUri);

    return NextResponse.json({
      detail: result.magic_link,
      email: result.email,
      token: result.token,
    });
  } catch (error) {
    console.error('OAuth login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface UserInfo {
  email: string;
  given_name: string;
  family_name: string;
}

export class GoogleOAuth {
  private clientId: string;
  private clientSecret: string;
  private jwtSecret: string;
  private magicLinkUrl: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.jwtSecret = process.env.JWT_SECRET || '';
    this.magicLinkUrl = process.env.AUTH_WEB + '/close/google' || '';
  }

  private async getTokens(code: string, redirectUri: string) {
    let doneTrying = false;
    let response;
    while (!doneTrying) {
      try {
        response = await axios
          .post('https://accounts.google.com/o/oauth2/token', {
            code: code.replaceAll('%2F', '/').replaceAll('%3D', '=').replaceAll('%3F', '?').replaceAll('%3D', '='),
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uri: process.env.AUTH_WEB + '/close/google',
            grant_type: 'authorization_code',
          })
          .catch((error) => error.response);
      } catch (exception) {
        console.error(exception);
      }
      /*
      if (response.status === 400 && response.data.error === 'invalid_grant') {
        console.error('Received invalid_grant from Google.');
        console.log('Attempting to reset authorization for oauth2 on this application.');
        await axios.post(
          'https://oauth2.googleapis.com/revoke',
          {
            token: code,
          },
          { headers: { 'content-type': 'application/x-www-form-urlencoded' } },
        );

      } else */
      if (response.status !== 200) {
        console.error("Failed to get authorization_code from Google's OAuth2 API.");
        console.log(response.data);
        doneTrying = true;
      } else {
        console.log('Done getting authorization_code: ', response.data);
        doneTrying = true;
      }
    }

    return response.data;
  }

  private async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await axios
      .get('https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .catch((error) => error.response);
    console.log('Got User Data: ', response.data);
    return {
      given_name: response.data.names[0].givenName,
      family_name: response.data.names[0].familyName,
      email: response.data.emailAddresses[0].value,
    };
  }

  private generateJWT(userId: string): string {
    return jwt.sign({ sub: userId }, this.jwtSecret, { expiresIn: '1d' });
  }

  private generateMagicLink(token: string): string {
    return `${this.magicLinkUrl}?token=${encodeURIComponent(token)}`;
  }

  async handleCallback(code: string, redirectUri: string) {
    const { access_token, refresh_token } = await this.getTokens(code, redirectUri);
    console.log('Got Tokens: ', access_token, refresh_token);
    const userInfo = await this.getUserInfo(access_token);
    const email = userInfo.email.toLowerCase().trim();
    const { id: userID } = await prisma.user.upsert({
      where: { email: email },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        firstName: userInfo.given_name.trim(),
        lastName: userInfo.family_name.trim(),
      },
      create: {
        email: email,
        accessToken: access_token,
        refreshToken: refresh_token,
        firstName: userInfo.given_name.trim(),
        lastName: userInfo.family_name.trim(),
      },
      select: {
        id: true,
      },
    });

    const token = this.generateJWT(userID);
    const magic_link = this.generateMagicLink(token);

    return {
      magic_link,
      email,
      token,
    };
  }
}
