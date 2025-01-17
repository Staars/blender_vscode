'use strict';

import * as vscode from 'vscode';
import * as os from 'os';
import * as child_process from 'child_process';
import * as request from 'request';
import * as fs from 'fs';
import * as zlib from 'zlib';
import * as tar from 'tar-fs';
import { join } from 'path';



export async function installPythonHeaderFiles(blenderPath: string) {

    vscode.window.showInformationMessage('Bundled Python Path: ' + blenderPath);
    let pythonPath = await getPythonPath(blenderPath);
    vscode.window.showInformationMessage('Bundled Python Version: ' + pythonPath);
    let pythonVersion = await getPythonVersion(pythonPath);
    vscode.window.showInformationMessage('Starting download Python:' + pythonVersion);
    downloadAndInstallPythonHeaders(pythonVersion, pythonPath);
}

function getPythonPath(blenderPath: string): Promise<string>  {
    let testString = '###TEST_BLENDER###';
    let command = blenderPath + ` --factory-startup -b --python-expr "import sys;print('${testString}');sys.stdout.flush();sys.exit()"`;
    console.log('BlenderPath:' + blenderPath);
    return new Promise<string>((resolve, reject) => {
        child_process.exec(command, {}, (err, stdout, stderr) => {
            let consoleOutput = stdout.toString();
            if (!consoleOutput.includes(testString)) {
                var message = 'A simple check to get a console output from blender to retrieve the path from the bundled python.';
                message += ' Please create a bug report when you are sure that the selected file is Blender 2.8 or newer.';
                message += ' The report should contain the full path to the executable.';
                   reject(new Error(message));
            }
            else {
                let fbp = 'found bundled python: ';
                let p ='/python';
                resolve(consoleOutput.slice(consoleOutput.search(fbp) + fbp.length, consoleOutput.search(p) + p.length));
            }
        });
    });
}


async function getPythonVersion(pythonPath: string): Promise<string> {
    let pythonBinary = join(pythonPath, 'bin', await getPythonBinary(pythonPath));
    return new Promise<string>((resolve, reject) => {
        child_process.exec(pythonBinary + ' -V', {}, (err, stdout, stderr) => {
            let text = stdout.toString();
            if (text.length === 0) {
                var message = 'Call Blender bundled python with -V failed.';
                reject(new Error(message));
            }
            else {
                resolve(text.slice(7,12));
            }
        });
    });
}

async function getPythonBinary(pythonPath: string): Promise<string> {
    console.log(pythonPath);
    return new Promise<string>((resolve, reject) => {
        let binaryPath = fs.readdirSync(join(pythonPath, 'bin')).filter(
            item =>
                fs.statSync(join(pythonPath, 'bin', item)).isFile() && (item.includes('python3'))
        ).sort();
        if (binaryPath.length === 0) {
            var message = 'Blender bundled python binary not found';
            reject(new Error(message));
        }
        else {
            resolve(binaryPath[0]);
        }
    });    
}

async function downloadAndInstallPythonHeaders(pythonVersion: string, pythonPath: string) {
    let url = 'https://www.python.org/ftp/python/'+ pythonVersion + '/Python-'+ pythonVersion + '.tgz';
    let unzip = zlib.createGunzip();
    let tmpDir = os.tmpdir();
    let archivePath = join(tmpDir, 'Python-' + pythonVersion + '.tgz');
    let shortPythonVersion = pythonVersion.slice(0,3);

    request.head(url, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    request(url).pipe(fs.createWriteStream(archivePath)).on('close', function()
        {
        vscode.window.showInformationMessage('Download done ! Now decompressing!');
        fs.createReadStream(archivePath).pipe(unzip).pipe(tar.extract(tmpDir)).on('finish', function () {
            vscode.window.showInformationMessage('Decompress done ! Now installing!');
            tar.pack(join(tmpDir, 'Python-' + pythonVersion, 'Include')).pipe(tar.extract(join(pythonPath, 'include', 'python' + shortPythonVersion + 'm'))).on('finish', function () {    
                vscode.window.showInformationMessage('Headers installed!');
                return;
              });
          });
        }); 
    });
}



export async function installPythonModule(blenderPath: string) {
    let pythonPath = await getPythonPath(blenderPath);
    console.log('Bundled python:' + pythonPath);
    let externalModule = await vscode.window.showInputBox();
    let pythonBinary = join(pythonPath, 'bin', await getPythonBinary(pythonPath));
    let command = pythonBinary + ' ' + join(pythonPath, 'lib', 'python3.7', 'site-packages','pip') + ' install ' + externalModule;

    return new Promise<string>((resolve, reject) => {
        child_process.exec(command, {}, (err, stdout, stderr) => {
            console.log(command);
            let text = stdout.toString();
            if (text.length === 0) {
                var message = 'Error calling bundled python.';
                console.log(text);
                reject(new Error(message));
            }
            else {
                vscode.window.showInformationMessage('External python module installed:' + externalModule);
                console.log(text);
                resolve();
            }
        });
    });
}