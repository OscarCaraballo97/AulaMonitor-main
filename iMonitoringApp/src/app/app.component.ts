import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  ellipsisVerticalOutline, logOutOutline, moonOutline, sunnyOutline, homeOutline, 
  calendarOutline, addCircleOutline, timeOutline, peopleOutline, businessOutline, 
  schoolOutline, peopleCircleOutline, listCircleOutline, personOutline, createOutline, 
  trashOutline, chevronDownOutline, chevronUpOutline, searchOutline, bookmarkOutline, 
  flaskOutline, megaphoneOutline, easelOutline, settingsOutline, contrastOutline, 
  mailOutline, lockClosedOutline, keyOutline, personAddOutline,

  documentTextOutline,
  folderOpenOutline,

  closeCircleOutline,
  checkmarkCircleOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonicModule, RouterModule],
})
export class AppComponent {
  constructor() {
    addIcons({
      ellipsisVerticalOutline, logOutOutline, moonOutline, sunnyOutline, homeOutline,
      calendarOutline, addCircleOutline, timeOutline, peopleOutline, businessOutline,
      schoolOutline, peopleCircleOutline, listCircleOutline, personOutline, createOutline,
      trashOutline, chevronDownOutline, chevronUpOutline, searchOutline, bookmarkOutline,
      flaskOutline, megaphoneOutline, easelOutline, settingsOutline, contrastOutline,
      mailOutline, lockClosedOutline, keyOutline, personAddOutline,
      documentTextOutline, folderOpenOutline,
      closeCircleOutline, checkmarkCircleOutline
    });
  }
}