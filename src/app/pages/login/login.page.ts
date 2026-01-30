
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'app-login',
    templateUrl: './login.page.html',
    styleUrls: ['./login.page.scss'],
    standalone: false,
})
export class LoginPage implements OnInit {
    email = '';
    password = '';

    constructor(private router: Router) { }

    ngOnInit() {
    }

    login() {
        console.log('Login attempt', this.email, this.password);
        this.router.navigate(['/map']);
    }

}
