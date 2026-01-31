import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private _storage: Storage | null = null;
    // Añadimos una Promesa para saber cuándo ha terminado de inicializarse
    private storageReady: Promise<void>;

    constructor(private storage: Storage) {
        // Guardamos la referencia de la inicialización
        this.storageReady = this.init();
    }

    async init() {
        const storage = await this.storage.create();
        this._storage = storage;
    }

    // Guardar un dato
    public async set(key: string, value: any) {
        // ESPERA a que el storage esté creado antes de intentar guardar
        await this.storageReady;
        return await this._storage?.set(key, value);
    }

    // Leer un dato
    public async get(key: string) {
        // ESPERA a que el storage esté creado antes de intentar leer
        await this.storageReady;
        return await this._storage?.get(key);
    }

    public async remove(key: string) {
        await this.storageReady;
        await this._storage?.remove(key);
    }

    public async clear() {
        await this.storageReady;
        await this._storage?.clear();
    }
}