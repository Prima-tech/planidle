import { Component, OnInit } from '@angular/core';
import { StatusService } from 'src/app/services/status';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
  standalone: false,
})
export class MainPage implements OnInit {

  constructor(
    private status: StatusService
  ) { }

  ngOnInit() {
  }

  test() {
    this.status.setStatus(10);
  }
}
