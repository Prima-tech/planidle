import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private _storage: Storage | null = null;

    constructor(private storage: Storage) {
        this.init();
    }

    async init() {
        // Es CRÍTICO llamar a create() antes de usar el storage
        const storage = await this.storage.create();
        this._storage = storage;
    }

    // Guardar un dato
    public async set(key: string, value: any) {
        return await this._storage?.set(key, value);
    }

    // Leer un dato
    public async get(key: string) {
        return await this._storage?.get(key);
    }

    // Eliminar un dato
    public async remove(key: string) {
        await this._storage?.remove(key);
    }

    // Limpiar toda la base de datos
    public async clear() {
        await this._storage?.clear();
    }
}