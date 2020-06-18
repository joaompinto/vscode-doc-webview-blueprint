

export class DocParser {

    constructor(private readonly filename: string) {
    }


    public async parseText(text: string): Promise<string> {
      return new Promise<string>((resolve) => {
        resolve(text);
      });
    }
}
