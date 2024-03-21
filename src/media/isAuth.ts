import { NextFunction, Request, Response } from "express";
import { get as _get, isEmpty } from 'lodash';

import { log } from '@roadmanjs/logs';
import { verify } from 'jsonwebtoken';

export const verifyAuthToken = (token: string) => {
    const secret = _get(process.env, 'ACCESS_TOKEN_SECRET', '');
    const verified = verify(token, secret, { ignoreExpiration: false });
    return verified;
};
/**
 *
 * @sets context.payload = { userId, iat, exp }
 * @param next
 * @returns
 */
export const isAuthRest = (req: any, res: Response, next: NextFunction) => {
    const authorization = _get(req, 'headers.authorization', '');
    try {

        if (isEmpty(authorization)) {
            throw new Error('Not Authenticated');
        }
        
        const token = authorization.split(' ')[1];
        const verified = verifyAuthToken(token);
        req.payload = verified;
    } catch (err) {
        log('not authenticated');
        return res.status(401).send('not authenticated');
    }

    return next();
};
