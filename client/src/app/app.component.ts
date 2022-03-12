import { SgbService } from './services/sgb.service';
import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { BreakpointObserver } from '@angular/cdk/layout';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {

  data: any;

  dataSource = new MatTableDataSource();
  displayColumns = ["symbol", "issuePrice", "maturityDate", "yearsToMaturity", "interestPayable", "presentValueDividend", "fairValue", "lastPrice", "discount", "yield"]

  @ViewChild(MatPaginator) paginator: MatPaginator;

  @ViewChild(MatSort) sort: MatSort;
  isMobile: boolean;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

  }

  constructor(
    private sgbService: SgbService,
    private breakpointObserver: BreakpointObserver
  ) {
    breakpointObserver.observe(['(max-width: 600px)']).subscribe(result => {
      this.isMobile = !!result.matches;
    });
  }
  ngOnInit() {
    this.sgbService.getSgbData().subscribe((data: any) => {
      this.data = data;
      console.log(this.data)

      this.dataSource = new MatTableDataSource(this.data.data);
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    })
  }

}
