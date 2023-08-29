export interface IStorageService {
  getFile(filename: string): Promise<any>; // Replace 'any' with your actual type
  getSystemMessages(): Promise<any>; // Replace 'any' with your actual type
  getPrompts(): Promise<any>; // Replace 'any' with your actual type
}
