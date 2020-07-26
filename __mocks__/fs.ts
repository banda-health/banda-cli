import { WriteFileOptions } from 'fs';

const fs: any = jest.genMockFromModule('fs');

let mockFileData: { [fileName: string]: string } = {};
function __setMockFileData(newMockFileData: { [fileName: string]: string }) {
	mockFileData = { ...newMockFileData };
}

function __getMockFileData(): { [fileName: string]: string } {
	return { ...mockFileData };
}

let mockFileList: string[] = [];
function __setMockFiles(newMockFileList: string[]) {
	mockFileList = [...newMockFileList];
}
function existsSync(path: string): boolean {
	return mockFileList.includes(path);
}

function writeFileSync(path: string, data: string, options?: WriteFileOptions): void {
	mockFileData[path] = data;
	mockFileList.push(path);
}

function readFileSync(path: string, options?: WriteFileOptions): string {
	return mockFileData[path] || '';
}

function unlinkSync(path: string): void {
	mockFileList.filter((mockedFile) => mockedFile !== path);
}

function __clearData(): void {
	mockFileData = {};
	mockFileList = [];
}

fs.__setMockFileData = __setMockFileData;
fs.__getMockFileData = __getMockFileData;
fs.writeFileSync = writeFileSync;
fs.readFileSync = readFileSync;
fs.__setMockFiles = __setMockFiles;
fs.existsSync = existsSync;
fs.unlinkSync = unlinkSync;
fs.__clearData = __clearData;

module.exports = fs;
