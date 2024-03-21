// TODO move to @roadmanjs/media / firebase-admin

import { MediaDataModel, MediaDataType } from "@roadmanjs/firebase-admin/dist/media/media.model";

import { RoadmanBuild } from "roadman";
import _get from "lodash/get";
import cors from "cors";
import express from "express";
import fs from 'fs';
import { isAuthRest } from "./isAuth";
import { isEmpty } from "lodash";
import mime from 'mime';
import multer from "multer";
import { uploadFileToFastdfs } from "@roadmanjs/firebase-admin/dist/media/media.methods";
import { v4 as uuidv4 } from 'uuid';

const uploadDirname = 'uploads';
const isFastDFS = !isEmpty(process.env.FASTDFS_SERVER || '');

const generateUUID = (): string => {
    return uuidv4();
};


const storage = multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
        cb(null, uploadDirname);
    },
    filename: (req: any, file: any, cb: any) => {
        // Generate a random filename
        const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = file.originalname.split('.').pop();
        cb(null, uniquePrefix + '.' + fileExtension);
    }
});

const upload = multer({ storage });

interface SaveFileToStorageType {
    localFile: string;
    filename?: string;
    owner?: string;
};

const saveFileToStorage = async (args: SaveFileToStorageType) => {
    const { localFile, filename, owner } = args;
    const newFileNameID = generateUUID();
    const fileExt = localFile.split('.').pop();
    const fullfilename = `${newFileNameID}.${fileExt}`;

    const mimetype = mime.getType(localFile);

    let savedToCloudUrl = null;
    if (isFastDFS) {
        // Save file to cloud
        savedToCloudUrl = await uploadFileToFastdfs(localFile, fullfilename);
    } else {

        const fileStats = fs.statSync(localFile)
        const fileSizeInBytes = fileStats.size;

        const fileLastPart = localFile.split(`${uploadDirname}/`).pop();
        const fileShortPath = uploadDirname + '/' + fileLastPart;

        savedToCloudUrl = {
            path: fileShortPath,
            url: `https://sslatt.com/${fileShortPath}`,
            size: fileSizeInBytes
        }

    }

    if (!savedToCloudUrl) {
        throw new Error('Not saved to cloud, please try again');
    }

    // Save file to db
    const newMediaData: MediaDataType = {
        id: newFileNameID,
        name: newFileNameID,
        filename,
        mimetype: mimetype || '',
        owner,
        size: savedToCloudUrl.size,
        path: savedToCloudUrl.path,
        url: savedToCloudUrl.url,
        server: 'fastdfs',
    };

    return await MediaDataModel.create<MediaDataType>(newMediaData);
};

export const mediaRoadman = async (args: RoadmanBuild): Promise<RoadmanBuild> => {
    const { app } = args;

    app.use(express.static('upload'))

    app.post('/upload', cors({ origin: "*", credentials: true }), isAuthRest, upload.array('files', 10), async (req: any, res: any) => {

        const owner = _get(req, "payload.userId");

        if (!req.files || req.files.length === 0) {
            return res.status(400).send('No files uploaded');
        }
        try {
            // Respond with details of uploaded files
            const uploadedFiles = await Promise.all(req.files.map((file: any) => saveFileToStorage({
                localFile: `${uploadDirname}/${file.filename}`,
                filename: file.originalname,
                owner
            })));

            res.status(200).json(uploadedFiles);

        }
        catch (error) {
            console.log("error uploading files")
            return res.status(400).send('Error uploading files');
        }

    });

    return args;
}