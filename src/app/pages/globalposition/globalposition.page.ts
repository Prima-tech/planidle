
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'app-globalposition',
    templateUrl: './globalposition.page.html',
    styleUrls: ['./globalposition.page.scss'],
    standalone: false,
})
export class GlobalpositionPage implements OnInit {

    constructor(private router: Router) { }

    ngOnInit() {
    }

    continuar() {
        console.log('Navegando desde globalposition');
        this.router.navigate(['/map']);
    }

}
