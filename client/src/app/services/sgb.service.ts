import { environment } from './../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SgbService {

  constructor(
    private http: HttpClient
  ) { }

  // Get SGB data
  getSgbData() {
    return this.http.get(environment.apiUrl + '/sgbs');
  }

}
