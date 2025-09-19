export enum CipherType {
  Login = 1,
  SecureNote = 2,
  Card = 3,
  Identity = 4,
}

export interface Cipher {
  id: string;
  type: CipherType;
  folderId?: string | null;
  organizationId: string | null;
  name: string;
  notes: string;
  favorite: boolean;
  login?: {
    response?: null;
    uri?: string;
    uris?: any[];
    username?: string;
    password?: string;
  };
}

export const newCipherTemplate: Cipher = {
  id: `new-${Date.now()}`,
  type: CipherType.Login,
  name: "",
  notes: "",
  favorite: false,
  login: {
    username: "",
    password: "",
    uri: "",
  },
  folderId: null,
  organizationId: null,
};

export const mockCiphers: Cipher[] = [
  {
    id: "1",
    type: CipherType.Login,
    name: "Gmail",
    notes: "Personal email account.",
    favorite: true,
    login: {
      username: "user@gmail.com",
      password: "supersecretpassword",
      uri: "https://mail.google.com",
    },
    folderId: null,
    organizationId: null,
  },
  {
    id: "2",
    type: CipherType.Login,
    name: "GitHub",
    notes: "Work account.",
    favorite: false,
    login: {
      username: "work-user",
      password: "anothersecretpassword",
      uri: "https://github.com",
    },
    folderId: null,
    organizationId: null,
  },
];
