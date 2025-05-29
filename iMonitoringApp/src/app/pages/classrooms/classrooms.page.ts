import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-classrooms',
  templateUrl: './classrooms.page.html',
  styleUrls: ['./classrooms.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class ClassroomsPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
