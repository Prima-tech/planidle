import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GameApiService {
  private url = 'http://localhost:3000/player';

  constructor(private http: HttpClient) { }

  // Para leer la vida, oro, etc.
  async loadData() {
    return await firstValueFrom(this.http.get(this.url));
  }

  // Para guardar cuando el jugador gane puntos
  async saveData(datos: any) {
    return await firstValueFrom(this.http.put(this.url, datos));
  }
}