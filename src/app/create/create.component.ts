import {Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit,style, animate, transition, trigger} from '@angular/core';
import {Location} from '@angular/common';
import {Http} from "@angular/http";
import {IndicatorGroupService, IndicatorGroup} from "../shared/services/indicator-group.service";
import {DatasetService, Dataset} from "../shared/services/dataset.service";
import {DataElementGroupService, DataElementGroup} from "../shared/services/data-element-group.service";
import {ScoreCard, ScorecardService} from "../shared/services/scorecard.service";
import {Router, ActivatedRoute} from "@angular/router";
import {$} from "protractor";
import {ProgramIndicatorsService, ProgramIndicatorGroups} from "../shared/services/program-indicators.service";
import {EventData, EventDataService} from "../shared/services/event-data.service";
import {throttleTime} from "rxjs/operator/throttleTime";
import {Subscription} from "rxjs";
import {DataService} from "../shared/data.service";
import {OrgUnitService} from "../shared/services/org-unit.service";
import {TreeNode, TREE_ACTIONS, IActionMapping, TreeComponent} from 'angular2-tree-component';
import {FilterService} from "../shared/services/filter.service";
import {FunctionService} from "../shared/services/function.service";

const actionMapping:IActionMapping = {
  mouse: {
    dblClick: TREE_ACTIONS.TOGGLE_EXPANDED,
    click: (node, tree, $event) => TREE_ACTIONS.TOGGLE_SELECTED_MULTI(node, tree, $event)
  }
};

@Component({
  selector: 'app-create',
  templateUrl: './create.component.html',
  styleUrls: ['./create.component.css'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [   // :enter is alias to 'void => *'
        style({opacity:0}),
        animate(600, style({opacity:1}))
      ]),
      transition(':leave', [   // :leave is alias to '* => void'
        animate(500, style({opacity:0}))
      ])
    ])
  ]
})
export class CreateComponent implements OnInit, AfterViewInit, OnDestroy {

  // variable initializations
  datasets: Dataset[];
  indicatorGroups: IndicatorGroup[];
  dataElementGroups: DataElementGroup[];
  programs: ProgramIndicatorGroups[];
  events: EventData[];
  functions:any =  [];
  current_groups: any[];
  current_listing: any[];
  activeGroup: string = null;
  done_loading_groups: boolean = false;
  done_loading_list: boolean = false;
  error_loading_groups: any = {occurred:false, message: ""};
  error_loading_list: any = {occurred:false, message: ""};
  scorecard: ScoreCard;
  listReady:boolean = false;
  listQuery: string = null;
  groupQuery: string = null;
  need_for_group: boolean = false;
  need_for_indicator: boolean = false;
  current_group_id: number = 1;
  current_holder_group_id: number = 1;
  current_indicator_holder: any;
  current_holder_group: any;
  saving_scorecard: boolean = false;
  saving_error: boolean = false;
  deleting: boolean[] = [];
  someErrorOccured: boolean = false;

  @ViewChild('title')
  title_element:ElementRef;

  @ViewChild('description')
  discription_element:ElementRef;

  @ViewChild('orgtree')
  orgtree: TreeComponent;

  @ViewChild('pertree')
  pertree: TreeComponent;
  periods: any[] = [];
  selected_periods:any = [];
  period_type: string = "Quarterly";
  year: number = 2016;
  dataset_types = [
    {id:'', name: "Reporting Rate"},
    {id:'.REPORTING_RATE_ON_TIME', name: "Reporting Rate on time"},
    {id:'.ACTUAL_REPORTS', name: "Actual Reports Submitted"},
    {id:'.ACTUAL_REPORTS_ON_TIME', name: "Reports Submitted on time"},
    {id:'.EXPECTED_REPORTS', name: "Expected Reports"}
  ];
  show_editor:boolean = false;
  editor;

  newLabel: string = "";

  private subscription: Subscription;

  show_bottleneck_indicators:boolean = false;
  bottleneck_card: any = {};

  new_color: string = "#fff";
  new_definition: string = "";

  current_action:string = "new";
  have_authorities:boolean = false;
  showOrgTree:boolean = true;
  showPerTree:boolean = true;
  showShareTree:boolean = true;
  showAdditionalOptions:boolean = true;
  orgunit_tree_config: any = {
    show_search : true,
    search_text : 'Search',
    level: null,
    loading: false,
    loading_message: 'Loading Organisation units...',
    multiple: true,
    placeholder: "Select Organisation Unit"
  };

  period_tree_config: any = {
    show_search : true,
    search_text : 'Search',
    level: null,
    loading: false,
    loading_message: 'Loading Periods...',
    multiple: true,
    placeholder: "Select period"
  };
  organisationunits: any[] = [];
  // custom settings for tree
  customTemplateStringOrgunitOptions: any = {
    isExpandedField: 'expanded',
    actionMapping
  };

  user:any = {};
  userGroups: any = [];
  group_loading = true;
  selected_groups: any = [];
  share_filter: string = "";
  group_type: string = "indicators";
  constructor(private http: Http,
              private indicatorService: IndicatorGroupService,
              private datasetService: DatasetService,
              private dataElementService: DataElementGroupService,
              private router: Router,
              private scorecardService: ScorecardService,
              private activatedRouter: ActivatedRoute,
              private programService: ProgramIndicatorsService,
              private eventService: EventDataService,
              private dataService: DataService,
              private _location: Location,
              private orgunitService: OrgUnitService,
              private filterService: FilterService,
              private functionService:FunctionService
  )
  {
    this.indicatorGroups = [];
    this.dataElementGroups = [];
    this.programs = [];
    this.events = [];
    this.datasets = [];
    this.current_groups = [];
    this.current_listing = [];
    // initialize the scorecard with a uid
    this.scorecard = this.scorecardService.getEmptyScoreCard();
    this.dataService.getUserInformation().subscribe(
      userInfo => {
        //noinspection TypeScriptUnresolvedVariable
        this.user.name = userInfo.name;
        this.user.id = userInfo.id;
        userInfo.userCredentials.userRoles.forEach( (role) => {
          role.authorities.forEach( (ath) => {
            if( ath == "ALL"){
              this.have_authorities = true;
            }
          } );

        })
      }
    );

    // this.getItemsFromGroups();
    this.current_indicator_holder = {
      "holder_id": this.getStartingIndicatorId(),
      "indicators": []
    };
    this.current_holder_group = {
      "id": this.getStartingGroupHolderId(),
      "name": "Default",
      "indicator_holder_ids": [],
      "background_color": "#ffffff",
      "holder_style": null
    };
  }

  ngOnInit() {
    this.dataService.getUserGroupInformation().subscribe( userGroups => {
      this.group_loading = false;
      this.userGroups = userGroups.userGroups;
    });
    this.subscription = this.activatedRouter.params.subscribe(
      (params: any) => {
        let id = params['scorecardid'];
        let type = params['type'];
        if(type == 'new'){
          this.period_type = this.scorecard.data.periodType;
          this.periods = this.filterService.getPeriodArray( this.period_type, this.year );
          // this.activateNode(this.filterService.getPeriodArray( this.period_type, this.year )[0].id, this.pertree);
          this.current_action = 'new';
          this.scorecard.data.user = this.user;
        }else{
          this.current_action = 'update';
          this.need_for_group = true;
          this.need_for_indicator = true;
          this.scorecardService.load(id).subscribe(
            scorecard_details => {
              this.scorecard = {
                id: id,
                name: scorecard_details.header.title,
                data: scorecard_details
              };
              //check if period configuration is there
              if(!this.scorecard.data.hasOwnProperty('periodType')){
                this.scorecard.data.periodType = "Quarterly";
              }
              if(!this.scorecard.data.hasOwnProperty('selected_periods')){
                this.scorecard.data.selected_periods = [];
              }
              if(!this.scorecard.data.hasOwnProperty('user')){
                this.scorecard.data.user = this.user;
              }
              if(!this.scorecard.data.hasOwnProperty('user_groups')){
                this.scorecard.data.user_groups = [];
              }
              // attach organisation unit if none is defined
              if(!this.scorecard.data.orgunit_settings.hasOwnProperty("selected_orgunits")){
                this.scorecard.data.orgunit_settings = {
                  "selection_mode": "Usr_orgUnit",
                  "selected_level": "",
                  "selected_group": "",
                  "orgunit_levels": [],
                  "orgunit_groups": [],
                  "selected_orgunits": [],
                  "user_orgunits": [],
                  "selected_user_orgunit": "USER_ORGUNIT"
                };
              }
              //activate organisation units
              for( let active_orgunit of this.scorecard.data.orgunit_settings.selected_orgunits ){
                this.activateNode(active_orgunit.id, this.orgtree);

              }
              // attach period type if none is defined
              if(!this.scorecard.data.hasOwnProperty("periodType")){
                this.scorecard.data.periodType = "Quarterly";
              }
              this.period_type = this.scorecard.data.periodType;
              // attach average_selection if none is defined
              if(!this.scorecard.data.hasOwnProperty("average_selection")){
                this.scorecard.data.average_selection = "all";
              }
              // attach shown_records if none is defined
              if(!this.scorecard.data.hasOwnProperty("shown_records")){
                this.scorecard.data.shown_records = "all";
              }
              // attach show_average_in_row if none is defined
              if(!this.scorecard.data.hasOwnProperty("show_average_in_row")){
                this.scorecard.data.show_average_in_row = false;
              }
              // attach show_average_in_column if none is defined
              if(!this.scorecard.data.hasOwnProperty("show_average_in_column")){
                this.scorecard.data.show_average_in_column = false;
              }
              //attach a property empty row if none is defined
              if(!this.scorecard.data.hasOwnProperty("empty_rows")){
                this.scorecard.data.empty_rows = true;
              }
              // this.getItemsFromGroups();
              let i = 0;
              for( let item of this.scorecard.data.data_settings.indicator_holder_groups ){
                i++;
                if(i == 1){
                  this.current_holder_group = item;
                }else{ continue; }

              }
              let j = 0;
              for( let item of this.scorecard.data.data_settings.indicator_holders){
                for( let indicator of item.indicators ){
                  if(!indicator.hasOwnProperty("bottleneck_indicators")){
                    indicator.bottleneck_indicators = [];
                  }
                }
                j++;
                if(j == 1){
                  this.current_indicator_holder = item;
                }else{ continue; }
              }

              if( this.scorecard.data.selected_periods.length == 0 ){
                this.periods = this.filterService.getPeriodArray( this.period_type, this.year );
                this.activateNode(this.filterService.getPeriodArray( this.period_type, this.year )[0].id, this.pertree);
              }else{
                this.periods = this.scorecard.data.selected_periods;
                this.scorecard.data.selected_periods.forEach((period) =>{
                  this.selected_periods.push(period);
                  let use_period = this.filterService.deducePeriodType(period.id);
                  this.period_type = use_period.type;
                  this.activateNode(period.id, this.pertree);
                })
              }
            });

        }
      }
    );
    //get indicatorGroups
    this.indicatorService.loadAll().subscribe(
      indicatorGroups => {
        for ( let group of indicatorGroups.indicatorGroups ) {
          this.indicatorGroups.push({
            id: group.id,
            name: group.name,
            indicators: []
          });
        }
        this.current_groups = this.indicatorGroups;
        this.bottleneck_card.current_groups = this.indicatorGroups;
        this.bottleneck_card.indicator = {};
        this.bottleneck_card.indicator_ready = false;
        this.error_loading_groups.occurred = false;
        this.done_loading_groups = true;
        this.bottleneck_card.done_loading_groups = true;
        this.load_list(this.current_groups[0].id, 'indicators');
        this.load_bottleneck_card_list(this.bottleneck_card.current_groups[0].id, 'indicators');
      },
      error => {
        this.error_loading_groups.occurred = true;
        this.error_loading_groups.message = "There was an error when loading Indicator Groups";
      }
    );
    //get dataElementsGroups
    this.dataElementService.loadAll().subscribe(
      dataElementGroups => {
        for ( let group of dataElementGroups.dataElementGroups ) {
          this.dataElementGroups.push({
            id: group.id,
            name: group.name,
            dataElements: []
          });
        }
      },
      error => {
        this.error_loading_groups.occurred = true;
        this.error_loading_groups.message = "There was an error when loading Data Element Groups";
      }
    );
    //get Programs
    this.programService.loadAll().subscribe(
      programs => {
        for ( let group of programs.programs ) {
          this.programs.push({
            id: group.id,
            name: group.name,
            indicators: []
          });
          this.events.push({
            id: group.id,
            name: group.name,
            indicators: []
          });
        }
      },
      error => {
        this.error_loading_groups.occurred = true;
        this.error_loading_groups.message = "There was an error when loading Programs";
      }
    );
    //get datasets
    this.datasetService.loadAll().subscribe(
      dataSets => {
        //noinspection TypeScriptUnresolvedVariable
        for ( let dataset of dataSets.dataSets ) {
          this.datasets.push({
            id: dataset.id,
            name: dataset.name,
            periodType: dataset.periodType
          });
        }
      },
      error => {
        this.error_loading_groups.occurred = true;
        this.error_loading_groups.message = "There was an error when loading Data sets";
      }
    );
    // get functions
    this.functionService.getAll().subscribe(
      functions => {
        //noinspection TypeScriptUnresolvedVariable
        this.functions = functions;
        console.log(functions)
      },
      error => {
        this.error_loading_groups.occurred = true;
        this.error_loading_groups.message = "There was an error when loading Data sets";
      }
    );
    //laod organisation units
    this.loadOrganisationUnit();

    //period configuration
    this.periods = this.filterService.getPeriodArray( this.period_type, this.year );
  }

  loadOrganisationUnit(){
    if (this.orgunitService.nodes == null) {
      this.orgunitService.getOrgunitLevelsInformation()
        .subscribe(
          (data: any) => {
            // assign urgunit levels and groups to variables
            this.scorecard.data.orgunit_settings.orgunit_levels = data.organisationUnitLevels;
            this.orgunitService.orgunit_levels = data.organisationUnitLevels;
            this.orgunitService.getOrgunitGroups().subscribe( groups => {//noinspection TypeScriptUnresolvedVariable
              this.scorecard.data.orgunit_settings.orgunit_groups = groups.organisationUnitGroups
              this.orgunitService.orgunit_groups = groups.organisationUnitGroups
            });

            this.orgunitService.getUserInformation().subscribe(
              userOrgunit => {
                let level = this.orgunitService.getUserHighestOrgUnitlevel( userOrgunit );
                this.scorecard.data.orgunit_settings.user_orgunits = this.orgunitService.getUserOrgUnits( userOrgunit );
                this.orgunitService.user_orgunits = this.orgunitService.getUserOrgUnits( userOrgunit );
                let all_levels = data.pager.total;
                let orgunits = this.orgunitService.getuserOrganisationUnitsWithHighestlevel( level, userOrgunit );
                let use_level = parseInt(all_levels) - (parseInt(level) - 1);

                //load inital orgiunits to speed up loading speed
                this.orgunitService.getInitialOrgunitsForTree(orgunits).subscribe(
                  (initial_data) => {
                    //noinspection TypeScriptUnresolvedVariable
                    this.organisationunits = initial_data.organisationUnits;
                    this.orgunit_tree_config.loading = false;
                    // after done loading initial organisation units now load all organisation units
                    let fields = this.orgunitService.generateUrlBasedOnLevels(use_level);
                    this.orgunitService.getAllOrgunitsForTree1(fields, orgunits).subscribe(
                      items => {
                        //noinspection TypeScriptUnresolvedVariable
                        this.organisationunits = items.organisationUnits;
                        //noinspection TypeScriptUnresolvedVariable
                        this.orgunitService.nodes = items.organisationUnits;
                        this.prepareOrganisationUnitTree(this.organisationunits, 'parent');
                      },
                      error => {
                        console.log('something went wrong while fetching Organisation units');
                        this.orgunit_tree_config.loading = false;
                      }
                    )
                  },
                  error => {
                    console.log('something went wrong while fetching Organisation units');
                    this.orgunit_tree_config.loading = false;
                  }
                )

              }
            )
          }
        );
    }
    else {
      this.orgunit_tree_config.loading = false;
      this.organisationunits = this.orgunitService.nodes;
      this.scorecard.data.orgunit_settings.orgunit_levels = this.orgunitService.orgunit_levels;
      this.scorecard.data.orgunit_settings.user_orgunits = this.orgunitService.user_orgunits;
      this.scorecard.data.orgunit_settings.orgunit_groups = this.orgunitService.orgunit_groups;

      this.prepareOrganisationUnitTree(this.organisationunits, 'parent');
    }
  }

  // this function is used to sort organisation unit
  prepareOrganisationUnitTree(organisationUnit,type:string='top') {
    if (type == "top"){
      if (organisationUnit.children) {
        organisationUnit.children.sort((a, b) => {
          if (a.name > b.name) {
            return 1;
          }
          if (a.name < b.name) {
            return -1;
          }
          // a must be equal to b
          return 0;
        });
        organisationUnit.children.forEach((child) => {
          this.prepareOrganisationUnitTree(child,'top');
        })
      }
    }else{
      organisationUnit.forEach((orgunit) => {
        console.log(orgunit);
        if (orgunit.children) {
          orgunit.children.sort((a, b) => {
            if (a.name > b.name) {
              return 1;
            }
            if (a.name < b.name) {
              return -1;
            }
            // a must be equal to b
            return 0;
          });
          orgunit.children.forEach((child) => {
            this.prepareOrganisationUnitTree(child,'top');
          })
        }
      });
    }
  }

  showOptions(){
    this.showAdditionalOptions = !this.showAdditionalOptions;
  }

  ngAfterViewInit(){
    this.title_element.nativeElement.focus();
    tinymce.init({
      selector: '#my-editor-id',
      height: 200,
      plugins: ['link', 'paste', 'table','image', 'code'],
      skin_url: 'assets/skins/lightgray',
      setup: editor => {
        this.editor = editor;
        editor.on('keyup', () => {
          // const content = editor.getContent();
          // this.keyupHandlerFunction(content);
        });
        editor.on('change', () => {
          const content = editor.getContent();
          this.scorecard.data.header.template.content = content;
        });
      },

    });
    if( this.current_action == 'new' ){
      this.activateNode(this.filterService.getPeriodArray( this.period_type, this.year )[0].id, this.pertree);
    }


  }
  // cancel scorecard creation process
  cancelCreate(){
    this._location.back();
  }
  // deal with all issues during group type switching between dataelent, indicators and datasets
  switchType(current_type): void{
    this.listReady = false;
    this.groupQuery = null;
    if(current_type == "indicators"){
      this.current_groups = this.indicatorGroups;
      if(this.current_groups.length != 0){
        this.load_list(this.current_groups[0].id, current_type)
      }
    }else if(current_type == "dataElements"){
      this.current_groups = this.dataElementGroups;
      if(this.current_groups.length != 0){
        this.load_list(this.current_groups[0].id, current_type)
      }
    }else if(current_type == "datasets"){
      this.current_groups = this.dataset_types;
      if(this.current_groups.length != 0){
        this.load_list(this.current_groups[0].id, current_type)
      }
    }else if(current_type == "programs"){
      this.current_groups = this.programs;
      if(this.current_groups.length != 0){
        this.load_list(this.current_groups[0].id, current_type)
      }
    }else if(current_type == "event"){
      this.current_groups = this.programs;
      if(this.current_groups.length != 0){
        this.load_list(this.current_groups[0].id, current_type)
      }
    }else if(current_type == "functions"){
      this.current_groups = this.functions;
      if(this.current_groups.length != 0){
        this.load_list(this.current_groups[0].id, current_type)
      }
    }else{

    }

  }

  // load items to be displayed in a list of indicators/ data Elements / Data Sets
  load_list(group_id,current_type): void{
    this.listQuery = null;
    this.activeGroup = group_id;
    this.listReady = true;
    this.current_listing = [];
    this.done_loading_list = false;
    if( current_type == "indicators" ){
      let load_new = false;
      for ( let group  of this.indicatorGroups ){
        if ( group.id == group_id ){
          if (group.indicators.length != 0){
            this.current_listing = group.indicators;
            this.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ){
        this.indicatorService.load(group_id).subscribe(
          indicators => {
            this.current_listing = indicators.indicators;
            this.done_loading_list = true;
            for ( let group  of this.indicatorGroups ){
              if ( group.id == group_id ){
                group.indicators = indicators.indicators;
              }
            }
          },
          error => {
            this.error_loading_list.occurred = true;
            this.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }

    }
    else if( current_type == "dataElements" ){
      let load_new = false;
      for ( let group  of this.dataElementGroups ){
        if ( group.id == group_id ){
          if (group.dataElements.length != 0){
            this.current_listing = group.dataElements;
            this.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ) {
        this.dataElementService.load(group_id).subscribe(
          dataElements => {
            this.current_listing = dataElements.dataElements;
            this.done_loading_list = true;
            for ( let group  of this.dataElementGroups ){
              if ( group.id == group_id ){
                group.dataElements = dataElements.dataElements;
              }
            }
          },
          error => {
            this.error_loading_list.occurred = true;
            this.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }
    }
    else if( current_type == "datasets" ){
      this.current_listing = [];
      let group_name = "";
      for (let dataset_group of this.dataset_types ){
        if(dataset_group.id == group_id){
          group_name = dataset_group.name;
        }
      }
      for( let dataset of this.datasets ){
        this.current_listing.push(
          {id:dataset.id+group_id, name: group_name+" "+dataset.name}
        )
      }
      this.listReady = true;
      this.done_loading_list = true;
      this.listQuery = null;
    }
    else if( current_type == "programs" ){
      let load_new = false;
      for ( let group  of this.programs ){
        if ( group.id == group_id ){
          if (group.indicators.length != 0){
            this.current_listing = group.indicators;
            this.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ){
        this.programService.load(group_id).subscribe(
          indicators => {
            this.current_listing = indicators.programs[0].programIndicators;
            this.done_loading_list = true;
            for ( let group  of this.programs ){
              if ( group.id == group_id ){
                group.indicators = indicators.programs.programIndicators;
              }
            }
          },
          error => {
            this.error_loading_list.occurred = true;
            this.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }

    }
    else if( current_type == "event" ){
      let load_new = false;
      for ( let group  of this.events ){
        if ( group.id == group_id ){
          if (group.indicators.length != 0){
            this.current_listing = group.indicators;
            this.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ){
        this.eventService.load(group_id).subscribe(
          indicators => {
            //noinspection TypeScriptUnresolvedVariable
            for (let event_data of indicators.programDataElements ){
              if(event_data.valueType == "INTEGER_ZERO_OR_POSITIVE" || event_data.valueType == "BOOLEAN" ){
                this.current_listing.push(event_data)
              }
            }
            this.done_loading_list = true;
            for ( let group  of this.events ){
              if ( group.id == group_id ){
                group.indicators = this.current_listing;
              }
            }
          },
          error => {
            this.error_loading_list.occurred = true;
            this.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }

    }
    else if( current_type == "functions" ){
      for ( let group  of this.functions ){
        if ( group.id == group_id ){
          if (group.rules.length != 0){
            this.current_listing = group.rules;
            this.done_loading_list = true;
          }else{
            this.done_loading_list = true;
            this.current_listing = [];
          }
        }
      }
    }else{

    }
  }

  // load a single item for use in a score card
  load_item(item): void{

    if( this.indicatorExist( this.scorecard.data.data_settings.indicator_holders, item )){
      this.deleteIndicator(item);
    }else{
      let indicator = this.scorecardService.getIndicatorStructure(item.name, item.id,this.getIndicatorLegendSet());
      if(this.group_type == "functions"){
        indicator.calculation = "custom_function";
        indicator.function_to_use = this.activeGroup;
      }
      indicator.value = Math.floor(Math.random() * 60) + 40;
      let random = Math.floor(Math.random() * 6) + 1;
      if( random % 2 == 0){ indicator.showTopArrow = true}
      else{ indicator.showBottomArrow = true}
      // ensure indicator has all additinal labels
      for (let label of this.scorecard.data.additional_labels ){
        indicator.additional_label_values[label] = "";
      }
      // this.current_indicator_holder.holder_id = this.current_group_id;
      if(this.current_indicator_holder.indicators.length < 2){
        this.current_indicator_holder.indicators.push( indicator );
      }else{
        this.current_group_id = this.getStartingIndicatorId() + 1;
        this.current_indicator_holder = {
          "holder_id": this.current_group_id,
          "indicators": []
        };
        this.current_indicator_holder.indicators.push( indicator );
        this.need_for_indicator = false;
        this.cleanUpEmptyColumns();
      }
      this.addIndicatorHolder(this.current_indicator_holder);
      this.current_holder_group.id = this.current_holder_group_id;
      this.addHolderGroups(this.current_holder_group, this.current_indicator_holder);
      console.log(indicator)
    }


  }

  // load a single item for use in a score card
  load_itemFromDragNDrop(item): void{

    if( this.indicatorExist( this.scorecard.data.data_settings.indicator_holders, item )){
      //this.deleteIndicator(item);
    }else{
      let indicator = this.scorecardService.getIndicatorStructure(item.name, item.id,this.getIndicatorLegendSet());
      indicator.value = Math.floor(Math.random() * 60) + 40;
      let random = Math.floor(Math.random() * 6) + 1;
      if( random % 2 == 0){ indicator.showTopArrow = true}
      else{ indicator.showBottomArrow = true}
      // ensure indicator has all additinal labels
      for (let label of this.scorecard.data.additional_labels ){
        indicator.additional_label_values[label] = "";
      }
      // this.current_indicator_holder.holder_id = this.current_group_id;
      if(this.current_indicator_holder.indicators.length < 2){
        this.current_indicator_holder.indicators.push( indicator );
      }else{
        this.current_group_id = this.getStartingIndicatorId() + 1;
        this.current_indicator_holder = {
          "holder_id": this.current_group_id,
          "indicators": []
        };
        this.current_indicator_holder.indicators.push( indicator );
        this.need_for_indicator = false;
        this.cleanUpEmptyColumns();
      }
      this.addIndicatorHolder(this.current_indicator_holder);
      this.current_holder_group.id = this.current_holder_group_id;
      this.addHolderGroups(this.current_holder_group, this.current_indicator_holder);
    }

  }

  // add an indicator holder to a scorecard
  addIndicatorHolder(indicator_holder): void{
    let add_new = true;
    for( let holder of this.scorecard.data.data_settings.indicator_holders ){
      if (holder.holder_id == indicator_holder.holder_id){
        holder = indicator_holder;
        add_new = false;
      }
    }
    if(add_new){
      this.scorecard.data.data_settings.indicator_holders.push(indicator_holder);
    }
    this.need_for_indicator = true;
  }

  // add a group of holders to a scorecard
  addHolderGroups( holder_group,holder,current_id: any = null ): void{
    this.need_for_group = true;
    let add_new = true;
    for( let group of this.scorecard.data.data_settings.indicator_holder_groups ){
      if (group.id == holder_group.id){
        if( group.indicator_holder_ids.indexOf(holder.holder_id) == -1 ){
          let index = this.findSelectedIndicatorIndex( current_id, group );
          group.indicator_holder_ids.splice(index,0,holder.holder_id);
          // group.indicator_holder_ids.push(holder.holder_id);
        }
        add_new = false;
      }
    }
    if(add_new){
      this.deleting[holder_group.id] = false;
      if( holder_group.indicator_holder_ids.indexOf(holder.holder_id) == -1 ) holder_group.indicator_holder_ids.push(holder.holder_id);
      this.scorecard.data.data_settings.indicator_holder_groups.push(holder_group);
    }
  }

  // add a group of holders to a scorecard
  addHolderGroupsFromDragNDrop( holder_group,holder,current_id: any = null ): void{
    this.need_for_group = true;
    let add_new = true;
    for( let group of this.scorecard.data.data_settings.indicator_holder_groups ){
      if (group.id == holder_group.id){
        if( group.indicator_holder_ids.indexOf(holder.holder_id) == -1 ){
          let index = this.findSelectedIndicatorIndex( current_id, group )-1;
          group.indicator_holder_ids.splice(index,0,holder.holder_id);
          // group.indicator_holder_ids.push(holder.holder_id);
        }
        add_new = false;
      }
    }
    if(add_new){
      this.deleting[holder_group.id] = false;
      if( holder_group.indicator_holder_ids.indexOf(holder.holder_id) == -1 ) holder_group.indicator_holder_ids.push(holder.holder_id);
      this.scorecard.data.data_settings.indicator_holder_groups.push(holder_group);
    }
  }

  // find the position of the selected Indicator
  findSelectedIndicatorIndex(current_id, group){
    let i = 0; let index = group.indicator_holder_ids.length;
    for ( let item of group.indicator_holder_ids ){
      i++;
      if( item == current_id ){
        index = i;
      }
    }
    return index;
  }

  // enabling creating of group
  createGroup(): void {
    this.current_holder_group_id = this.scorecard.data.data_settings.indicator_holders.length + 1;
    this.current_holder_group = {
      "id": this.current_holder_group_id,
      "name": "New Group",
      "indicator_holder_ids": [],
      "background_color": "#ffffff",
      "holder_style": null
    };
    this.enableAddIndicator();
  }

  // enable adding of new Indicator
  enableAddIndicator( current_id: any = null ): void{
    this.current_group_id = this.getStartingIndicatorId() + 1;
    this.current_indicator_holder = {
      "holder_id": this.current_group_id,
      "indicators": []
    };
    this.need_for_indicator = false;
    this.cleanUpEmptyColumns();

    this.addIndicatorHolder(this.current_indicator_holder);
    this.current_holder_group.id = this.current_holder_group_id;
    this.addHolderGroups(this.current_holder_group, this.current_indicator_holder, current_id);
  }

  // enable adding of new Indicator
  enableAddIndicatorFromDragNDrop( current_id: any = null ): void{
    this.current_group_id = this.getStartingIndicatorId() + 1;
    this.current_indicator_holder = {
      "holder_id": this.current_group_id,
      "indicators": []
    };
    this.need_for_indicator = false;
    this.cleanUpEmptyColumns();

    this.addIndicatorHolder(this.current_indicator_holder);
    this.current_holder_group.id = this.current_holder_group_id;
    this.addHolderGroupsFromDragNDrop(this.current_holder_group, this.current_indicator_holder, current_id);
  }

  //try to deduce last number needed to start adding indicator
  getStartingIndicatorId(): number{
    let last_id = 1;
    for(let holder of this.scorecard.data.data_settings.indicator_holders){
      if( holder.holder_id > last_id){
        last_id = holder.holder_id;
      }
    }
    return last_id;
  }

  //try to deduce last number needed to start adding holder group
  getStartingGroupHolderId(): number{
    let last_id = 1;
    for(let group of this.scorecard.data.data_settings.indicator_holder_groups){
      if( group.id > last_id){
        last_id = group.id;
      }
    }
    return last_id;
  }

  //pass through the scorecard and delete all empty rows
  cleanUpEmptyColumns(){
    let deleted_id = null;
    this.scorecard.data.data_settings.indicator_holders.forEach((item, index) => {
      if(item.indicators.length == 0){
        deleted_id = item.holder_id;
        this.scorecard.data.data_settings.indicator_holders.splice(index,1);
      }
    });
    this.scorecard.data.data_settings.indicator_holder_groups.forEach( (group, groupIndex)=>{
      group.indicator_holder_ids.forEach((item, index) => {
        if(item == deleted_id){
          group.indicator_holder_ids.splice(index,1);
        }
        if(group.indicator_holder_ids.length == 0){
          this.scorecard.data.data_settings.indicator_holder_groups.splice(groupIndex,1);
        }
      })
    });
  }

  deleteEmptyGroups(){
    this.scorecard.data.data_settings.indicator_holder_groups.forEach( (group, groupIndex)=>{
      if( group.indicator_holder_ids.length == 0){
        this.scorecard.data.data_settings.indicator_holder_groups.splice(groupIndex,1);
      }
    });
  }

  //function to remove the indicator holder group form the scorecard
  deleteGroup(holderGroup){
    for( let holder of holderGroup.indicator_holder_ids ){
      this.scorecard.data.data_settings.indicator_holders.forEach((item, index)=>{
        if(item.holder_id == holder){
          this.scorecard.data.data_settings.indicator_holders.splice(index,1);
        }
      })
    }
    this.scorecard.data.data_settings.indicator_holder_groups.forEach((item, index)=>{
      if(item.id == holderGroup.id){
        this.scorecard.data.data_settings.indicator_holder_groups.splice(index,1);
      }
    })
  }

  // this will enable updating of indicator
  updateIndicator(indicator:any): void{
    this.current_indicator_holder = indicator;
    this.need_for_indicator = true;
    this.scorecard.data.data_settings.indicator_holder_groups.forEach( (group, groupIndex) => {
      if(group.indicator_holder_ids.indexOf(indicator.holder_id) > -1){
        this.current_holder_group = group;
        this.current_holder_group_id = group.id;
      }
    });
    this.cleanUpEmptyColumns();
  }

  //deleting indicator from score card
  deleteIndicator(indicator_to_delete): void{
    this.scorecard.data.data_settings.indicator_holders.forEach((holder, holder_index) => {
      holder.indicators.forEach((indicator, indicator_index) => {
        if( indicator.id == indicator_to_delete.id){
          holder.indicators.splice(indicator_index,1);
        }
      });
    });
    this.cleanUpEmptyColumns();
  }

  // A function used to decouple indicator list and prepare them for a display
  getItemsFromGroups(): any[]{
    let indicators_list = [];
    for(let data of this.scorecard.data.data_settings.indicator_holder_groups ){
      for( let holders_list of data.indicator_holder_ids ){
        for( let holder of this.scorecard.data.data_settings.indicator_holders ){
          if(holder.holder_id == holders_list){
            indicators_list.push(holder)
          }
        }
      }
    }
    return indicators_list;
  }

  // simplify title displaying by switching between two or on indicator
  getIndicatorTitle(holder): string{
    var title = [];
    for( let data of holder.indicators ){
      title.push(data.title)
    }
    return title.join(' / ')
  }

  // assign a background color to area depending on the legend set details
  assignBgColor(object,value): string{
    var color = "#BBBBBB";
    for( let data of object.legendset ){
      if(data.max == "-"){

        if(parseInt(value) >= parseInt(data.min) ){
          color = data.color;
        }
      }else{
        if(parseInt(value) >= parseInt(data.min) && parseInt(value) <= parseInt(data.max)){
          color = data.color;
        }
      }
    }
    return color;
  }

  //check if the indicator is already added in a scorecard
  indicatorExist(holders,indicator): boolean {
  let check = false;
  for( let holder of holders ){
    for( let indicatorValue of holder.indicators ){
      if(indicatorValue.id == indicator.id){
        check = true;
      }
    }
  }
  return check;
};

  // check if this is the current selected group
  is_current_group(group: any):boolean {
    let check = false;
    if(group.id == this.current_holder_group.id) {
      check = true;
    }
    return check;
  }

  // check if this is the current selected indicator
  is_current_indicator(indicator: any):boolean {
    let check = false;
    if ( indicator.holder_id == this.current_indicator_holder.holder_id ){
      check = true;
    }
    return check;
  }

  //enable text editor popup
  showTextEditor(){
    this.show_editor = !this.show_editor;
  }

  addAditionalLabel(){
    if(this.newLabel != ""){
      this.scorecard.data.additional_labels.push(this.newLabel);
      for ( let holder of this.scorecard.data.data_settings.indicator_holders ){
        for (let indicator of holder.indicators ){
          indicator.additional_label_values[this.newLabel] = "";
        }
      }
      this.newLabel = "";
    }
  }

  deleteAdditionalLabel(label){
    this.scorecard.data.additional_labels.splice(this.scorecard.data.additional_labels.indexOf(label),1);
    for ( let holder of this.scorecard.data.data_settings.indicator_holders ){
      for (let indicator of holder.indicators ){
        indicator.additional_label_values[this.newLabel] = "";
      }
    }
    console.log(this.scorecard.data.data_settings);
  }

  getIndicatorLabel(indicator, label){
    let labels = [];
    for( let data of indicator.indicators ){
      if(data.additional_label_values[label] != null && data.additional_label_values[label] != ""){
        labels.push(data.additional_label_values[label])
      }
    }
    return labels.join(' / ')
  }

  // saving scorecard details
  saveScoreCard(action: string = "save"): void {
    // display error if some fields are missing
    if(this.scorecard.data.data_settings.indicator_holders.length == 0 || this.scorecard.data.header.title == '' || this.scorecard.data.header.description == ''){
      this.someErrorOccured = true;
      if(this.scorecard.data.header.description == ''){
        this.discription_element.nativeElement.focus();
      }
      if(this.scorecard.data.header.title == ''){
        this.title_element.nativeElement.focus();
      }
      setTimeout(() => {
        this.someErrorOccured = false;
      }, 3000);

    }else{
      // delete all empty indicators if any
      this.cleanUpEmptyColumns();

      // add related indicators to another datastore to enable flexible data analysis
      this.scorecard.data.data_settings.indicator_holders.forEach((holder) => {
        holder.indicators.forEach( (indicator) => {
          if( indicator.bottleneck_indicators.length != 0 ){
            this.scorecardService.addRelatedIndicator(indicator.id, indicator.bottleneck_indicators);
          }
        })
      });

      this.scorecard.data.selected_periods = this.selected_periods;
      // post the data
      this.saving_scorecard = true;
      if(action == "save"){
        this.scorecardService.create(this.scorecard).subscribe(
          (data) => {
            this.saving_scorecard = false;
            this.router.navigate(['view',this.scorecard.id]);
          },
          error => {
            this.saving_error = true;
            this.saving_scorecard = false
          }
        );
      }
      else{
        this.scorecardService.update(this.scorecard).subscribe(
          (data) => {
            this.saving_scorecard = false;
            this.router.navigate(['view',this.scorecard.id]);
          },
          error => {
            this.saving_error = true;
            this.saving_scorecard = false
          }
        );
      }


    }


  }

  /**
   * Bottleneck indicator issues
   * @param indicator
   */
  showBotleneckEditor(indicator){
    if(this.show_bottleneck_indicators){
      for( let holder of this.scorecard.data.data_settings.indicator_holders ){
        for (let item of holder.indicators ){
          if(item.id == indicator.id){
            item.bottleneck_indicators = this.bottleneck_card.indicator.bottleneck_indicators;
          }
        }
      }
    }else{
      this.bottleneck_card.indicator = indicator;
      this.bottleneck_card.indicator_ready = true;
    }

    this.show_bottleneck_indicators = !this.show_bottleneck_indicators;
  }

  // deal with all issues during group type switching between dataelent, indicators and datasets
  switchBottleneckType(current_type): void{
    this.bottleneck_card.listReady = false;
    this.bottleneck_card.groupQuery = null;
    if(current_type == "indicators"){
      this.bottleneck_card.current_groups = this.indicatorGroups;
      if(this.bottleneck_card.current_groups.length != 0){
        this.load_bottleneck_card_list(this.bottleneck_card.current_groups[0].id, current_type)
      }
    }else if(current_type == "dataElements"){
      this.bottleneck_card.current_groups = this.dataElementGroups;
      if(this.bottleneck_card.current_groups.length != 0){
        this.load_bottleneck_card_list(this.bottleneck_card.current_groups[0].id, current_type)
      }
    }else if(current_type == "datasets"){
      this.bottleneck_card.current_groups = this.dataset_types;
      if(this.bottleneck_card.current_groups.length != 0){
        this.load_bottleneck_card_list(this.bottleneck_card.current_groups[0].id, current_type)
      }
    }else if(current_type == "programs"){
      this.bottleneck_card.current_groups = this.programs;
      if(this.bottleneck_card.current_groups.length != 0){
        this.load_bottleneck_card_list(this.bottleneck_card.current_groups[0].id, current_type)
      }
    }else if(current_type == "event"){
      this.bottleneck_card.current_groups = this.programs;
      if(this.bottleneck_card.current_groups.length != 0){
        this.load_bottleneck_card_list(this.bottleneck_card.current_groups[0].id, current_type)
      }
    }else{

    }

  }

  // load items to be displayed in a list of indicators/ data Elements / Data Sets
  load_bottleneck_card_list(group_id,current_type): void{
    this.bottleneck_card.listQuery = null;
    this.bottleneck_card.activeGroup = group_id;
    this.bottleneck_card.listReady = true;
    this.bottleneck_card.current_listing = [];
    this.bottleneck_card.done_loading_list = false;
    this.bottleneck_card.error_loading_list = {};
    if( current_type == "indicators" ){
      let load_new = false;
      for ( let group  of this.indicatorGroups ){
        if ( group.id == group_id ){
          if (group.indicators.length != 0){
            this.bottleneck_card.current_listing = group.indicators;
            this.bottleneck_card.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ){
        this.indicatorService.load(group_id).subscribe(
          indicators => {
            this.bottleneck_card.current_listing = indicators.indicators;
            this.bottleneck_card.done_loading_list = true;
            for ( let group  of this.indicatorGroups ){
              if ( group.id == group_id ){
                group.indicators = indicators.indicators;
              }
            }
          },
          error => {
            this.bottleneck_card.error_loading_list.occurred = true;
            this.bottleneck_card.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }

    }
    else if( current_type == "dataElements" ){
      let load_new = false;
      for ( let group  of this.dataElementGroups ){
        if ( group.id == group_id ){
          if (group.dataElements.length != 0){
            this.bottleneck_card.current_listing = group.dataElements;
            this.bottleneck_card.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ) {
        this.dataElementService.load(group_id).subscribe(
          dataElements => {
            this.bottleneck_card.current_listing = dataElements.dataElements;
            this.bottleneck_card.done_loading_list = true;
            for ( let group  of this.dataElementGroups ){
              if ( group.id == group_id ){
                group.dataElements = dataElements.dataElements;
              }
            }
          },
          error => {
            this.bottleneck_card.error_loading_list.occurred = true;
            this.bottleneck_card.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }
    }
    else if( current_type == "datasets" ){
      this.bottleneck_card.current_listing = [];
      let group_name = "";
      for (let dataset_group of this.dataset_types ){
        if(dataset_group.id == group_id){
          group_name = dataset_group.name;
        }
      }
      for( let dataset of this.datasets ){
        this.bottleneck_card.current_listing.push(
          {id:dataset.id+group_id, name: group_name+" "+dataset.name}
        )
      }
      this.bottleneck_card.done_loading_list = true;
    }
    else if( current_type == "programs" ){
      let load_new = false;
      for ( let group  of this.programs ){
        if ( group.id == group_id ){
          if (group.indicators.length != 0){
            this.bottleneck_card.current_listing = group.indicators;
            this.bottleneck_card.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ){
        this.programService.load(group_id).subscribe(
          indicators => {
            this.bottleneck_card.current_listing = indicators.programs[0].programIndicators;
            this.bottleneck_card.done_loading_list = true;
            for ( let group  of this.programs ){
              if ( group.id == group_id ){
                group.indicators = indicators.programs.programIndicators;
              }
            }
          },
          error => {
            this.bottleneck_card.error_loading_list.occurred = true;
            this.bottleneck_card.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }

    }
    else if( current_type == "event" ){
      let load_new = false;
      for ( let group  of this.events ){
        if ( group.id == group_id ){
          if (group.indicators.length != 0){
            this.bottleneck_card.current_listing = group.indicators;
            this.bottleneck_card.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ){
        this.eventService.load(group_id).subscribe(
          indicators => {
            //noinspection TypeScriptUnresolvedVariable
            for (let event_data of indicators.programDataElements ){
              if(event_data.valueType == "INTEGER_ZERO_OR_POSITIVE" || event_data.valueType == "BOOLEAN" ){
                this.bottleneck_card.current_listing.push(event_data)
              }
            }
            this.bottleneck_card.done_loading_list = true;
            for ( let group  of this.events ){
              if ( group.id == group_id ){
                group.indicators = this.bottleneck_card.current_listing;
              }
            }
          },
          error => {
            this.bottleneck_card.error_loading_list.occurred = true;
            this.bottleneck_card.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }

    }
    else{

    }
  }

  // a function to check if bottleneck indicator exists
  botteneckIndicatorExist(item): boolean {
    let check  = false;
    if(this.bottleneck_card.indicator.hasOwnProperty("bottleneck_indicators") ){
      for( let indicator of this.bottleneck_card.indicator.bottleneck_indicators ){
        if( indicator.id == item.id){
          check = true;
        }
      }
    }
    return check;
  }

  // a function that displays a card to add bottleneck indicators
  load_bottleneck_card_item(item){
    if(this.botteneckIndicatorExist(item)){
      this.removeBottleneckIndicator(item)
    }else{
      item.bottleneck_title= item.name;
      item.baseline = null;
      item.target = null;
      this.bottleneck_card.indicator.bottleneck_indicators.push(item);
    }
  }

  // a function to remove bottleneck indicator
  removeBottleneckIndicator(item){
    this.bottleneck_card.indicator.bottleneck_indicators.forEach( (value, index) =>{
      if( value.id == item.id ){
        this.bottleneck_card.indicator.bottleneck_indicators.splice(index,1);
      }
    })
  }

  // remove a set of legend
  show_delete_legend: boolean[] = [];
  showDeleteWarnig(index){
    if( this.scorecard.data.data_settings.indicator_holders.length == 0){
      this.deleteLegand(index);
    }else{
      this.show_delete_legend[index] = true;;
    }

  }

  cancelDeleteLegend(index){
    this.show_delete_legend[index] = false;
  }

  deleteLegand(index){
    this.scorecard.data.legendset_definitions.splice(index,1);
    this.show_delete_legend[index] = false;
    this.scorecard.data.data_settings.indicator_holders.forEach( (holder) => {
      holder.indicators.forEach( (indicator) => {
        let legend_length = this.scorecard.data.legendset_definitions.length - 2;
        let indicator_legend = [];
        let initial_value = 100;

        for (let legend of this.scorecard.data.legendset_definitions ){
          if(!legend.hasOwnProperty("default")){
            indicator_legend.push(
              {
                color: legend.color,
                min: initial_value-Math.round(100/legend_length),
                max: initial_value
              }
            );
          }
          initial_value = initial_value-Math.round(100/legend_length)
        }
        indicator.legendset = indicator_legend;
      })
    })
  }

  // add a legend set
  show_add_legend: boolean = false;
  showAddWarning(){
    if( this.scorecard.data.data_settings.indicator_holders.length == 0){
      this.addLegend();
    }else{
      this.show_add_legend = true;
    }
  }

  addLegend(){
    this.show_add_legend = false;
    let index = this.findFirstDefaultLegend();
    let new_legend = {
      color: this.new_color,
      definition: this.new_definition
    };
    this.scorecard.data.legendset_definitions.splice(index,0,new_legend);
    this.new_color = "#fff";
    this.new_definition = "";
    // loop through indicators and regenerate the legend set
    this.scorecard.data.data_settings.indicator_holders.forEach( (holder) => {
      holder.indicators.forEach( (indicator) => {
        let legend_length = this.scorecard.data.legendset_definitions.length - 2;
        let indicator_legend = [];
        let initial_value = 100;

        for (let legend of this.scorecard.data.legendset_definitions ){
          if(!legend.hasOwnProperty("default")){
            indicator_legend.push(
              {
                color: legend.color,
                min: initial_value-Math.round(100/legend_length),
                max: initial_value
              }
            );
          }
          initial_value = initial_value-Math.round(100/legend_length)
        }
        indicator.legendset = indicator_legend;
      })
    })
  }

  getIndicatorLegendSet(){
    let legend_length = this.scorecard.data.legendset_definitions.length - 2;
    let indicator_legend = [];
    let initial_value = 100;

    for (let legend of this.scorecard.data.legendset_definitions ){
      if(!legend.hasOwnProperty("default")){
        indicator_legend.push(
          {
            color: legend.color,
            min: initial_value-Math.round(100/legend_length),
            max: initial_value
          }
        );
      }
      initial_value = initial_value-Math.round(100/legend_length)
    }
    return indicator_legend;
  }

  cancelAddLegend(){
    this.show_add_legend = false;
  }

  findFirstDefaultLegend(){
    let i = 0; let index = 0;
    for ( let item of this.scorecard.data.legendset_definitions ){
      if( item.hasOwnProperty("default") ){
        index = i-1;
      }
      i++;
    }
    return index;
  }

  // check if legend color exist
  checkLegendColorExist(color){
    let checker = false;
    for ( let item of this.scorecard.data.legendset_definitions ){
      if (item.color == color){
        checker = true;
      }
    }
    return checker;
  }

  // display Orgunit Tree
  displayOrgTree(){
    this.showOrgTree = !this.showOrgTree;
  }

  // display period Tree
  displayPerTree(){
    this.showPerTree = !this.showPerTree;
  }

  // display sharing Tree
  displayShareTree(){
    this.showShareTree = !this.showShareTree;
  }

  // action to be called when a tree item is deselected(Remove item in array of selected items
  deactivateOrg ( $event ) {
    this.scorecard.data.orgunit_settings.selected_orgunits.forEach((item,index) => {
      if( $event.node.data.id == item.id ) {
        this.scorecard.data.orgunit_settings.selected_orgunits.splice(index, 1);
      }
    });
  };

  // add item to array of selected items when item is selected
  activateOrg = ($event) => {
    if(!this.checkItemAvailabilty($event.node.data, this.scorecard.data.orgunit_settings.selected_orgunits)){
      this.scorecard.data.orgunit_settings.selected_orgunits.push($event.node.data);
    }
  };


  // action to be called when a tree item is deselected(Remove item in array of selected items
  deactivatePer ( $event ) {
    this.selected_periods.forEach((item,index) => {
      if( $event.node.data.id == item.id ) {
        this.selected_periods.splice(index, 1);
      }
    });
  };

  /// add item to array of selected items when period is selected
  activatePer = ($event) => {
    if(!this.checkItemAvailabilty($event.node.data, this.selected_periods)){
      this.selected_periods.push($event.node.data);
    }
  };


  activateNode(nodeId:any, nodes){
    setTimeout(() => {
      let node = nodes.treeModel.getNodeById(nodeId);
      if (node)
      // node.toggleActivated();
        node.setIsActive(true,true);
    }, 0);
  }

  // a method to activate the model
  deActivateNode(nodeId:any, nodes, event){
    setTimeout(() => {
      let node = nodes.treeModel.getNodeById(nodeId);
      if (node)
        node.setIsActive(false, true);
    }, 0);
    if( event != null){
      event.stopPropagation();
    }
  }

  pushPeriodForward(){
    this.year += 1;
    this.periods = this.filterService.getPeriodArray(this.period_type,this.year);
  }

  pushPeriodBackward(){
    this.year -= 1;
    this.periods = this.filterService.getPeriodArray(this.period_type,this.year);
  }

  changePeriodType(){
    this.periods = this.filterService.getPeriodArray(this.period_type,this.year);
  }

  // add user sharing settings
  toogleGroup(type,group){
    if(group.hasOwnProperty(type)){
        group[type] = !group[type];
    }else{
      group[type] = true;
    }
    if(!this.checkItemAvailabilty(group,this.scorecard.data.user_groups)){
      this.scorecard.data.user_groups.push(group)
    }else{
      this.scorecard.data.user_groups.forEach((value,index) => {
        if( value.id == group.id ){
          this.scorecard.data.user_groups[index] = group;
        }
      });
    }
    if(!group['see'] && !group['edit']){
      this.scorecard.data.user_groups.forEach((value,index) => {
        if( value.id == group.id ){
          this.scorecard.data.user_groups.splice(index,1);
        }
      });
    }

  }

  getGroupActiveState(type,group): boolean{
    let checker = false;
    this.scorecard.data.user_groups.forEach((value) => {
      if( value.id == group.id && value.hasOwnProperty(type)){
        checker = value[type];
      }
    });
    return checker;
  }


  // check if orgunit already exist in the orgunit display list
  checkItemAvailabilty(item, array): boolean{
    let checker = false;
    array.forEach((value) => {
      if( value.id == item.id ){
        checker = true;
      }
    });
    return checker;
  }

  // function that is used to filter nodes
  filterNodes(text, tree) {
    tree.treeModel.filterNodes(text, true);
  }

  // prepare a proper name for updating the organisation unit display area.
  getProperPreOrgunitName() : string{
    let name = "";
    if( this.scorecard.data.orgunit_settings.selection_mode == "Group" ){
      let use_value = this.scorecard.data.orgunit_settings.selected_group.split("-");
      for( let single_group of this.scorecard.data.orgunit_settings.orgunit_groups ){
        if ( single_group.id == use_value[1] ){
          name = single_group.name + " in";
        }
      }
    }else if( this.scorecard.data.orgunit_settings.selection_mode == "Usr_orgUnit" ){
      if( this.scorecard.data.orgunit_settings.selected_user_orgunit == "USER_ORGUNIT") name = "User org unit";
      if( this.scorecard.data.orgunit_settings.selected_user_orgunit == "USER_ORGUNIT_CHILDREN") name = "User sub-units";
      if( this.scorecard.data.orgunit_settings.selected_user_orgunit == "USER_ORGUNIT_GRANDCHILDREN") name = "User sub-x2-units";
    }else if( this.scorecard.data.orgunit_settings.selection_mode == "Level" ){
      let use_level = this.scorecard.data.orgunit_settings.selected_level.split("-");
      for( let single_level of this.scorecard.data.orgunit_settings.orgunit_levels ){
        if ( single_level.level == use_level[1] ){
          name = single_level.name + " in";
        }
      }
    }else{
      name = "";
    }
    return name
  }

  transferDataSuccess($event, drop_area:string, object:any){
    if(drop_area == "group"){
      // check if someone is trying to reorder items within the scorecard

      if( $event.dragData.hasOwnProperty('holder_id') ){
        let last_holder = ( object.indicator_holder_ids.length == 0 )?0:object.indicator_holder_ids.length - 1;
        if(object.indicator_holder_ids.indexOf($event.dragData.holder_id) ==-1){
          this.deleteHolder( $event.dragData );
          this.insertHolder( $event.dragData, this.getHolderById(object.indicator_holder_ids[last_holder]), 1);
          this.updateIndicator($event.dragData);
        }else{ }
        this.deleteEmptyGroups();
      }
      else if($event.dragData.hasOwnProperty('indicator_holder_ids')){
        if($event.dragData.id != object.id){
          this.scorecard.data.data_settings.indicator_holder_groups.forEach((group, group_index) => {
            if( group.id == $event.dragData.id){
              this.scorecard.data.data_settings.indicator_holder_groups.splice(group_index,1);
            }
          });
          this.scorecard.data.data_settings.indicator_holder_groups.forEach((group, group_index) => {
            if( group.id == object.id && this.getgroupById($event.dragData.id) == null){
              this.scorecard.data.data_settings.indicator_holder_groups.splice(group_index,0,$event.dragData);
            }
          });
        }

      }
      else{
        let last_holder_position = ( object.indicator_holder_ids.length == 0 )?0:object.indicator_holder_ids.length - 1;
        this.updateIndicator(this.getHolderById(object.indicator_holder_ids[last_holder_position]));
        this.enableAddIndicator(this.current_indicator_holder.holder_id);
        this.load_item($event.dragData)
      }
    }
    else if(drop_area == "table_data"){
      // check if someone is trying to reorder items within the scorecard
      if( $event.dragData.hasOwnProperty('holder_id') ){
        if( $event.dragData.holder_id == object.holder_id ){
          console.log("cant move item to itself");
        }
        else{
          let position = this.getHolderPosition($event.dragData,object);
          this.deleteHolder( $event.dragData );
          this.insertHolder( $event.dragData, object, position);
          this.updateIndicator($event.dragData);
        }
        this.deleteEmptyGroups();
      }
      else if($event.dragData.hasOwnProperty('indicator_holder_ids')){ }
      else{
        this.updateIndicator(object);
        this.enableAddIndicatorFromDragNDrop(this.current_indicator_holder.holder_id);
        this.load_itemFromDragNDrop($event.dragData)
      }
    }
    else if(drop_area == "new-group"){
      this.createGroup();
      if( $event.dragData.hasOwnProperty('holder_id') ){
        let last_holder = ( this.getgroupById(this.current_holder_group_id).indicator_holder_ids.length == 0 )?0:this.getgroupById(this.current_holder_group_id).indicator_holder_ids.length - 1;
        if(this.getgroupById(this.current_holder_group_id).indicator_holder_ids.indexOf($event.dragData.holder_id) ==-1){
          this.deleteHolder( $event.dragData );
          this.insertHolder( $event.dragData, this.getHolderById(this.getgroupById(this.current_holder_group_id).indicator_holder_ids[last_holder]), 1);
          this.updateIndicator($event.dragData);
        }else{ }
      }else if($event.dragData.hasOwnProperty('indicator_holder_ids')){}
      else{
        this.enableAddIndicator(this.current_indicator_holder.holder_id);
        this.load_item($event.dragData)
      }
    }
    else{
      if( $event.dragData.hasOwnProperty('holder_id') ){ }
      else if($event.dragData.hasOwnProperty('indicator_holder_ids')){ }
      else{
        this.enableAddIndicator(this.current_indicator_holder.holder_id);
        this.load_item($event.dragData)
      }
    }
  }

  getgroupById(group_id){
    let return_id = null;
    for ( let group of this.scorecard.data.data_settings.indicator_holder_groups ){
      if( group.id == group_id ){
        return_id = group;
        break;
      }
    }
    return return_id;
  }

  getHolderById( holder_id ){
    let return_id = null;
    for ( let holder of this.scorecard.data.data_settings.indicator_holders ){
      if( holder.holder_id == holder_id ){
        return_id = holder;
        break;
      }
    }
    return return_id;
  }

  deleteHolder( holder_to_delete ){
    this.scorecard.data.data_settings.indicator_holder_groups.forEach((group, holder_index) => {
      group.indicator_holder_ids.forEach((holder, indicator_index) => {
        if( holder == holder_to_delete.holder_id){
          group.indicator_holder_ids.splice(indicator_index,1);
        }
      });
    });
  }

  insertHolder( holder_to_insert, current_holder, num:number ){
    this.scorecard.data.data_settings.indicator_holder_groups.forEach((group, holder_index) => {
      group.indicator_holder_ids.forEach((holder, indicator_index) => {
        console.log(holder +"=="+ current_holder.holder_id);
        if( holder == current_holder.holder_id && group.indicator_holder_ids.indexOf(holder_to_insert.holder_id) == -1){
          group.indicator_holder_ids.splice( indicator_index+num,0,holder_to_insert.holder_id );
        }
      });
    });
    this.cleanUpEmptyColumns();
  }

  // Dertimine if indicators are in the same group and say whether the first is larger of not
  getHolderPosition(holder_to_check, current_holder){
    let holders_in_same_group = false;
    let holder_group = null;
    let increment_number = 0;
    this.scorecard.data.data_settings.indicator_holder_groups.forEach((group, holder_index) => {
      if(group.indicator_holder_ids.indexOf(holder_to_check.holder_id) != -1 && group.indicator_holder_ids.indexOf(current_holder.holder_id) != -1){
        holders_in_same_group = true;
        holder_group = group.indicator_holder_ids;
      }
    });
    if(holders_in_same_group){
      if( holder_group.indexOf(holder_to_check.holder_id) > holder_group.indexOf(current_holder.holder_id)){
        increment_number = 0;
      }else{
        increment_number = 1;
      }
    }
    return increment_number;
  }

  //helper function to dynamical provide colspan attribute for a group
  getGroupColspan(group_holders){
    let colspan= 0;
    for (let holder of this.scorecard.data.data_settings.indicator_holders ){
      if(group_holders.indexOf(holder.holder_id) != -1){
        if(this.selected_periods.length == 0){
          colspan++
        }else{
          for (let per of this.selected_periods){
            colspan++
          }
        }
      }
    }
    return colspan;
  }


  ngOnDestroy() {
    tinymce.remove(this.editor);
  }


}
