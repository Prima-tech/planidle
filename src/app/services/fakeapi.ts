import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class FakeApiService {

  private usuarios: Usuario[] = [
    { id: 1, nombre: 'Juan Pérez', email: 'juan@example.com' },
    { id: 2, nombre: 'Ana Gómez', email: 'ana@example.com' },
    { id: 3, nombre: 'Carlos Ruiz', email: 'carlos@example.com' }
  ]
  playerInfo = {
    name: 'Vlod',
    class: {
        name: 'warrior'
    }
	};

  constructor() { }

  getUserData(): Observable<any> {
    return of(this.playerInfo).pipe(
      delay(1000) // simula 1 segundo de espera
    );
  }

  getUsuarioPorId(id: number): Observable<Usuario | undefined> {
    const usuario = this.usuarios.find(u => u.id === id);
    return of(usuario).pipe(delay(500));
  }
}
